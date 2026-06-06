import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'

// ── World layout (1600 × 1200) ───────────────────────────────────────────────
//
//   North room  (goblins):  x=0..800,   y=0..600
//   Center room (start):    x=0..800,   y=600..1200
//   East room   (empty):    x=800..1600, y=600..1200
//
// Passages connect rooms through gaps in shared walls:
//   Center ↔ North: x=340..460, at y=600  (width 120)
//   Center ↔ East:  y=860..940, at x=800  (height 80)

const WORLD_W = 1600
const WORLD_H = 1200

// Room centers for camera pan targets
const ROOM_CAMERA = {
  center: { x: 400,  y: 900 },
  north:  { x: 400,  y: 300 },
  east:   { x: 1200, y: 900 },
}

// Passage bounds (in world coords)
const PASS_N = { x1: 340, x2: 460, y: 600 } // center↔north, horizontal seam
const PASS_E = { y1: 860, y2: 940, x: 800 } // center↔east, vertical seam

type Room = 'center' | 'north' | 'east'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Callback injected by the React wrapper so the Phaser scene can call store actions
interface SceneCallbacks {
  startScenario: (nodeId: string, scenario: string) => void
  getMode: () => string
}

declare global {
  interface Window {
    __rpgScene?: DungeonScene
    __rpgCallbacks?: SceneCallbacks
  }
}

class DungeonScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc
  private gritContainer!: Phaser.GameObjects.Container
  private nimContainer!: Phaser.GameObjects.Container
  private boleContainer!: Phaser.GameObjects.Container
  private goblinContainers: Phaser.GameObjects.Container[] = []

  private cursorGfx!: Phaser.GameObjects.Graphics
  private clickRingGfx!: Phaser.GameObjects.Graphics

  private moveTarget: { x: number; y: number } | null = null
  private readonly SPEED = 130 // px / s

  private currentRoom: Room = 'center'
  private cameraPanning = false
  private inDialogue = false
  private goblinTriggered = false

  // Dark overlay shown while in dialogue mode
  private overlayRect!: Phaser.GameObjects.Rectangle

  constructor() {
    super({ key: 'DungeonScene' })
  }

  create() {
    this.drawWorld()
    this.createGoblins()

    // Player — blue circle
    this.player = this.add.circle(400, 900, 10, 0x5599ff).setDepth(5)

    // Dialogue overlay (full-world size so it covers everything when panned)
    this.overlayRect = this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x000000)
      .setAlpha(0)
      .setDepth(20)

    // Custom cursor graphics
    this.cursorGfx = this.add.graphics().setDepth(100)
    this.clickRingGfx = this.add.graphics().setDepth(99)
    this.drawCursor()

    // Camera: start centered on center room
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.centerOn(ROOM_CAMERA.center.x, ROOM_CAMERA.center.y)

    // Point-and-click input
    this.input.on('pointerdown', this.handleClick, this)

    // Expose scene to React wrapper
    window.__rpgScene = this
  }

  // ── Per-frame update ────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    // Cursor follows pointer in world space
    const ptr = this.input.activePointer
    this.cursorGfx.setPosition(ptr.worldX, ptr.worldY)
    this.cursorGfx.setVisible(!this.inDialogue)

    if (this.inDialogue || this.cameraPanning || !this.moveTarget) return

    const dx = this.moveTarget.x - this.player.x
    const dy = this.moveTarget.y - this.player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 4) {
      this.moveTarget = null
      return
    }

    const step = Math.min(this.SPEED * (delta / 1000), dist)
    this.player.x += (dx / dist) * step
    this.player.y += (dy / dist) * step

    this.checkRoomTransition()
    this.checkGoblinTrigger()
  }

  // ── World drawing ───────────────────────────────────────────────────────────

  private drawWorld() {
    const g = this.add.graphics().setDepth(0)

    // Room floors
    g.fillStyle(0x111a11).fillRect(0, 0, 800, 600)          // north  — earthy green
    g.fillStyle(0x1a1612).fillRect(0, 600, 800, 600)         // center — warm brown
    g.fillStyle(0x111118).fillRect(800, 600, 800, 600)       // east   — cold blue-grey

    // Passage corridors (slightly different tone to read as floor)
    g.fillStyle(0x181614)
    g.fillRect(PASS_N.x1, PASS_N.y - 15, PASS_N.x2 - PASS_N.x1, 30) // north passage
    g.fillRect(PASS_E.x - 15, PASS_E.y1, 30, PASS_E.y2 - PASS_E.y1) // east passage

    // Stone detail — subtle scattered marks
    g.fillStyle(0x1a2619, 0.7)
    for (let i = 0; i < 18; i++) {
      g.fillRect(30 + (i * 41) % 730, 30 + (i * 29) % 540, 14, 8)
    }
    g.fillStyle(0x1e1a14, 0.7)
    for (let i = 0; i < 14; i++) {
      g.fillRect(20 + (i * 53) % 750, 630 + (i * 37) % 540, 16, 9)
    }

    // Walls — draw individual segments with passage gaps
    this.drawWalls(g)

    // Room labels (very dim, monospace, top-left of each room)
    const labelStyle = { fontSize: '11px', fontFamily: 'monospace', color: '#2a3020', alpha: 0.5 }
    this.add.text(14, 8, 'NORTH', labelStyle).setDepth(1).setAlpha(0.35)
    this.add.text(14, 608, 'CENTER', labelStyle).setDepth(1).setAlpha(0.35)
    this.add.text(814, 608, 'EAST', labelStyle).setDepth(1).setAlpha(0.35)

    // Campfire in north room
    const fire = this.add.circle(400, 330, 9, 0xff6600).setDepth(3)
    const glow = this.add.circle(400, 330, 18, 0xff4400).setAlpha(0.18).setDepth(2)
    this.tweens.add({
      targets: [fire, glow],
      scaleX: 1.22, scaleY: 1.22,
      alpha: { from: 1, to: 0.65 },
      duration: 380,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  private drawWalls(g: Phaser.GameObjects.Graphics) {
    const W = 2
    const c = 0x4a3a28
    g.lineStyle(W, c, 1)

    // Helper: stroke a line segment
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      g.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2))

    const { x1: nx1, x2: nx2 } = PASS_N
    const { y1: ey1, y2: ey2 } = PASS_E

    // North room (0,0 → 800,600) — south wall has passage gap
    line(0, 0, 800, 0)          // top
    line(0, 0, 0, 600)          // left
    line(800, 0, 800, 600)      // right
    line(0, 600, nx1, 600)      // south left of gap
    line(nx2, 600, 800, 600)    // south right of gap

    // Center room (0,600 → 800,1200) — north wall = south of north room (same gap)
    line(0, 600, nx1, 600)      // north left of gap (shared)
    line(nx2, 600, 800, 600)    // north right of gap (shared)
    line(0, 600, 0, 1200)       // left
    line(0, 1200, 800, 1200)    // bottom
    line(800, 600, 800, ey1)    // right above passage
    line(800, ey2, 800, 1200)   // right below passage

    // East room (800,600 → 1600,1200) — left wall = right of center (same gap)
    line(800, 600, 1600, 600)   // top
    line(800, 600, 800, ey1)    // left above passage (shared)
    line(800, ey2, 800, 1200)   // left below passage (shared)
    line(1600, 600, 1600, 1200) // right
    line(800, 1200, 1600, 1200) // bottom
  }

  // ── Goblins ─────────────────────────────────────────────────────────────────

  private createGoblins() {
    const makeGoblin = (
      wx: number, wy: number,
      r: number, color: number,
      label: string,
    ): Phaser.GameObjects.Container => {
      const circle = this.add.circle(0, 0, r, color)
      const text = this.add
        .text(0, -r - 7, label, {
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#' + color.toString(16).padStart(6, '0'),
        })
        .setOrigin(0.5, 1)
      const container = this.add.container(wx, wy, [circle, text])
      container.setDepth(4)
      return container
    }

    this.gritContainer = makeGoblin(360, 300, 10, 0x6e8257, 'GRIT')
    this.nimContainer  = makeGoblin(310, 370,  8, 0x9fb046, 'NIM')
    this.boleContainer = makeGoblin(490, 375, 13, 0x8a924f, 'BOLE')
    this.goblinContainers = [this.gritContainer, this.nimContainer, this.boleContainer]

    // GRIT paces back and forth around the fire
    this.tweens.add({
      targets: this.gritContainer,
      x: 460,
      duration: 2200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  // ── Cursor ──────────────────────────────────────────────────────────────────

  private drawCursor() {
    this.cursorGfx.clear()
    this.cursorGfx.lineStyle(1.5, 0xc8a96e, 0.85)
    // Four short arms with a gap in the center
    this.cursorGfx.strokeLineShape(new Phaser.Geom.Line(-9, 0, -3, 0))
    this.cursorGfx.strokeLineShape(new Phaser.Geom.Line( 3, 0,  9, 0))
    this.cursorGfx.strokeLineShape(new Phaser.Geom.Line(0, -9, 0, -3))
    this.cursorGfx.strokeLineShape(new Phaser.Geom.Line(0,  3, 0,  9))
    this.cursorGfx.fillStyle(0xc8a96e, 0.7)
    this.cursorGfx.fillCircle(0, 0, 1.5)
  }

  private showClickRing(wx: number, wy: number) {
    this.clickRingGfx.clear()
    this.clickRingGfx.setPosition(wx, wy).setAlpha(1).setScale(1)
    this.clickRingGfx.lineStyle(1.5, 0xc8a96e, 0.9)
    this.clickRingGfx.strokeCircle(0, 0, 12)
    this.tweens.add({
      targets: this.clickRingGfx,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.clickRingGfx.clear().setAlpha(1).setScale(1)
      },
    })
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  private handleClick(pointer: Phaser.Input.Pointer) {
    if (this.inDialogue || this.cameraPanning) return
    const target = this.resolveTarget(pointer.worldX, pointer.worldY)
    if (!target) return
    this.moveTarget = target
    this.showClickRing(target.x, target.y)
  }

  // Resolve a click into a move target, or null if it's not reachable.
  // Clicks inside a passage corridor are snapped to a point on the FAR side of
  // the seam so the player always walks all the way through and the room
  // transition reliably fires (instead of stopping short inside the doorway).
  private resolveTarget(wx: number, wy: number): { x: number; y: number } | null {
    const { x1: nx1, x2: nx2 } = PASS_N
    const { y1: ey1, y2: ey2 } = PASS_E
    const pad = 12

    // Generous corridor bands spanning both sides of each seam.
    const inNorthCorridor = wx >= nx1 && wx <= nx2 && wy >= 540 && wy <= 660
    const inEastCorridor  = wy >= ey1 && wy <= ey2 && wx >= 740 && wx <= 860

    if (this.currentRoom === 'center') {
      if (inNorthCorridor) return { x: clamp(wx, nx1 + 8, nx2 - 8), y: 560 } // into north
      if (inEastCorridor)  return { x: 840, y: clamp(wy, ey1 + 8, ey2 - 8) } // into east
      if (wx >= pad && wx <= 800 - pad && wy >= 600 + pad && wy <= 1200 - pad)
        return { x: wx, y: wy }
      return null
    }
    if (this.currentRoom === 'north') {
      if (inNorthCorridor) return { x: clamp(wx, nx1 + 8, nx2 - 8), y: 640 } // into center
      if (wx >= pad && wx <= 800 - pad && wy >= pad && wy <= 600 - pad)
        return { x: wx, y: wy }
      return null
    }
    // east
    if (inEastCorridor) return { x: 760, y: clamp(wy, ey1 + 8, ey2 - 8) } // into center
    if (wx >= 800 + pad && wx <= 1600 - pad && wy >= 600 + pad && wy <= 1200 - pad)
      return { x: wx, y: wy }
    return null
  }

  // ── Room transitions ─────────────────────────────────────────────────────────

  private checkRoomTransition() {
    const px = this.player.x
    const py = this.player.y
    const { x1: nx1, x2: nx2 } = PASS_N
    const { y1: ey1, y2: ey2 } = PASS_E

    if (this.currentRoom === 'center') {
      if (py <= 600 && px >= nx1 - 10 && px <= nx2 + 10) {
        this.enterRoom('north', 400, 560)
      } else if (px >= 800 && py >= ey1 - 10 && py <= ey2 + 10) {
        this.enterRoom('east', 840, 900)
      }
    } else if (this.currentRoom === 'north') {
      if (py >= 600 && px >= nx1 - 10 && px <= nx2 + 10) {
        this.enterRoom('center', 400, 640)
      }
    } else if (this.currentRoom === 'east') {
      if (px <= 800 && py >= ey1 - 10 && py <= ey2 + 10) {
        this.enterRoom('center', 760, 900)
      }
    }
  }

  private enterRoom(room: Room, playerX: number, playerY: number) {
    this.currentRoom = room
    this.cameraPanning = true
    this.moveTarget = null
    this.player.setPosition(playerX, playerY)

    const target = ROOM_CAMERA[room]
    this.cameras.main.pan(
      target.x, target.y,
      480,
      'Sine.easeInOut',
      false,
      (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) this.cameraPanning = false
      },
    )
  }

  // ── Goblin proximity trigger ─────────────────────────────────────────────────

  private checkGoblinTrigger() {
    if (this.goblinTriggered || this.currentRoom !== 'north') return

    // Trigger box spans the full width of the north room and 90% of its height,
    // measured from the top — so the player can't slip past the goblins. Only
    // the bottom 10% (the entry strip nearest the passage) is safe.
    const boxBottom = 600 * 0.9 // y = 540
    if (this.player.y <= boxBottom) {
      this.goblinTriggered = true
      this.moveTarget = null
      window.__rpgCallbacks?.startScenario('goblin_confront', 'goblin')
    }
  }

  // ── Called from React wrapper on mode changes ────────────────────────────────

  setDialogueMode(active: boolean) {
    this.inDialogue = active
    this.tweens.add({
      targets: this.overlayRect,
      alpha: active ? 0.72 : 0,
      duration: 200,
    })
  }
}

// ── React component ──────────────────────────────────────────────────────────

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const mode = useGameStore((s) => s.gameMode)
  const startScenario = useGameStore((s) => s.startScenario)

  // Wire up callbacks so the Phaser scene can reach the store
  useEffect(() => {
    window.__rpgCallbacks = {
      startScenario,
      getMode: () => useGameStore.getState().gameMode,
    }
  }, [startScenario])

  // Create the Phaser game once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      backgroundColor: '#111111',
      parent: containerRef.current,
      scene: [DungeonScene],
    }

    gameRef.current = new Phaser.Game(config)

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      window.__rpgScene = undefined
    }
  }, [])

  // Sync dialogue mode into the scene when the store mode changes
  useEffect(() => {
    const scene = window.__rpgScene
    if (scene) scene.setDialogueMode(mode === 'dialogue')
  }, [mode])

  return (
    <div
      ref={containerRef}
      style={{ lineHeight: 0 }}  // prevent extra space under canvas
    />
  )
}
