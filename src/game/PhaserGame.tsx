import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'
import { dialogueNodes } from '../data/dialogueData'

// Nodes whose continue-choice ends the scenario, derived from the dialogue
// graph so the animation dispatch stays in sync with the data.
const KILL_NODES = new Set<string>()  // killed all three → goblin_cleared
const FLEE_NODES = new Set<string>()  // escaped / talked past → goblin_exit
const FLED_NODES = new Set<string>()  // goblins driven out alive → goblin_fled
for (const [nid, node] of Object.entries(dialogueNodes)) {
  for (const c of node.choices) {
    if (c.nextNodeId === 'goblin_cleared') KILL_NODES.add(nid)
    if (c.nextNodeId === 'goblin_exit') FLEE_NODES.add(nid)
    if (c.nextNodeId === 'goblin_fled') FLED_NODES.add(nid)
  }
}

// ── Goblin-scene tableau (north room, fire at 400,330) ───────────────────────
const GOBLIN_HOME = {
  grit: { x: 360, y: 295 },
  nim:  { x: 305, y: 372 },
  bole: { x: 470, y: 366 },
}
const FIRE_POS     = { x: 400, y: 330 }
const PLAYER_DARK  = { x: 380, y: 545 }  // watching from the threshold
const PLAYER_FIRE  = { x: 380, y: 448 }  // stepped into the firelight
const ENCIRCLE     = { x: 380, y: 372, r: 74 }
const PASSAGE_TOP  = { x: 400, y: 48 }   // the onward (north) passage mouth

// Combat staging. The player fights from below (back toward the threshold/fire)
// upward toward the goblins, who hold the line between Fiodor and the passage.
const COMBAT = {
  player:     { x: 400, y: 462 },          // squared up, weight set
  playerWall: { x: 250, y: 470 },          // backed into the left wall (brace)
  // Three-goblin flanking formation: BOLE forward and central, NIM left,
  // GRIT right — they slide wide to take the angles.
  bole: { x: 400, y: 392 },
  nim:  { x: 300, y: 410 },
  grit: { x: 500, y: 410 },
}

// ── World layout ─────────────────────────────────────────────────────────────
//
//   Deep room   (empty):    x=0..800,   y=-600..0   (warped to after escape)
//   North room  (goblins):  x=0..800,   y=0..600
//   Center room (start):    x=0..800,   y=600..1200
//   East room   (empty):    x=800..1600, y=600..1200
//
// Passages connect rooms through gaps in shared walls:
//   Deep   ↔ North: x=340..460, at y=0    (width 120, one-way after escape)
//   Center ↔ North: x=340..460, at y=600  (width 120)
//   Center ↔ East:  y=860..940, at x=800  (height 80)

const WORLD_BOUNDS = { x: 0, y: -600, w: 1600, h: 1800 }

// Room centers for camera pan targets
const ROOM_CAMERA = {
  deep:   { x: 400,  y: -300 },
  center: { x: 400,  y: 900 },
  north:  { x: 400,  y: 300 },
  east:   { x: 1200, y: 900 },
}

// Passage bounds (in world coords)
const PASS_D = { x1: 340, x2: 460, y: 0 }   // deep↔north, horizontal seam
const PASS_N = { x1: 340, x2: 460, y: 600 } // center↔north, horizontal seam
const PASS_E = { y1: 860, y2: 940, x: 800 } // center↔east, vertical seam

type Room = 'deep' | 'center' | 'north' | 'east'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Callback injected by the React wrapper so the Phaser scene can call store actions
interface SceneCallbacks {
  startScenario: (nodeId: string, scenario: string) => void
  openRefusal: () => void
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
  // Set once the goblin chamber has been resolved and left. Makes the goblin
  // room one-way (refusal) when escaped, or fully open when cleared by killing.
  private goblinDone = false
  private goblinOutcome: 'escaped' | 'cleared' | 'fled' | null = null
  // Splatter graphics drawn in place of the goblins once the room is cleared.
  private splatterGfx?: Phaser.GameObjects.Graphics
  // Per-node animation state for the goblin scenario.
  private goblinSceneReady = false
  private aliveGoblins: Phaser.GameObjects.Container[] = []
  // Registry of in-flight *action* tweens/timers so a click can fast-forward
  // them to their end state. Looping ambient tweens (banter/hop) are NOT
  // registered, so fast-forwarding leaves the idle motion running.
  private actionTweens = new Set<Phaser.Tweens.Tween>()
  private actionTimers = new Set<Phaser.Time.TimerEvent>()

  // ── Monster (east room) ──────────────────────────────────────────────────────
  private monsterTriggered = false
  private monsterDone = false
  private monsterContainer!: Phaser.GameObjects.Container
  private monsterEyes: Phaser.GameObjects.Arc[] = []
  private monsterBreathTween?: Phaser.Tweens.Tween

  constructor() {
    super({ key: 'DungeonScene' })
  }

  create() {
    this.drawWorld()
    this.createGoblins()
    this.createMonster()

    // Player — blue circle
    this.player = this.add.circle(400, 900, 10, 0x5599ff).setDepth(5)

    // Custom cursor graphics
    this.cursorGfx = this.add.graphics().setDepth(100)
    this.clickRingGfx = this.add.graphics().setDepth(99)
    this.drawCursor()

    // Camera: start centered on center room
    this.cameras.main.setBounds(WORLD_BOUNDS.x, WORLD_BOUNDS.y, WORLD_BOUNDS.w, WORLD_BOUNDS.h)
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
    this.checkMonsterTrigger()
  }

  // ── World drawing ───────────────────────────────────────────────────────────

  private drawWorld() {
    const g = this.add.graphics().setDepth(0)

    // Room floors
    g.fillStyle(0x0c0d12).fillRect(0, -600, 800, 600)        // deep   — near-black
    g.fillStyle(0x111a11).fillRect(0, 0, 800, 600)          // north  — earthy green
    g.fillStyle(0x1a1612).fillRect(0, 600, 800, 600)         // center — warm brown
    g.fillStyle(0x111118).fillRect(800, 600, 800, 600)       // east   — cold blue-grey

    // Passage corridors (slightly different tone to read as floor)
    g.fillStyle(0x181614)
    g.fillRect(PASS_D.x1, PASS_D.y - 15, PASS_D.x2 - PASS_D.x1, 30) // deep passage
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
    this.add.text(14, -592, 'DEEP', labelStyle).setDepth(1).setAlpha(0.3)
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
    const { x1: dx1, x2: dx2 } = PASS_D
    const { y1: ey1, y2: ey2 } = PASS_E

    // Deep room (0,-600 → 800,0) — south wall has passage gap to north room
    line(0, -600, 800, -600)    // top
    line(0, -600, 0, 0)         // left
    line(800, -600, 800, 0)     // right
    line(0, 0, dx1, 0)          // south left of gap
    line(dx2, 0, 800, 0)        // south right of gap

    // North room (0,0 → 800,600) — north wall = south of deep (same gap); south wall has gap
    line(0, 0, dx1, 0)          // north left of gap (shared)
    line(dx2, 0, 800, 0)        // north right of gap (shared)
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

  // A furred, carapaced bulk curled over something the player can't make out —
  // built from the same primitive-shape language as the goblins, just much larger.
  private createMonster() {
    const wx = 1300
    const wy = 950

    // The indistinct mound it's curled around — deliberately unresolved.
    const mound = this.add.ellipse(-6, 10, 46, 24, 0x1a1a22).setAlpha(0.8)

    const body = this.add.ellipse(0, 0, 120, 64, 0x4a3b2a)
    const furTexture = this.add.ellipse(0, -6, 104, 46, 0x5b4a36).setAlpha(0.6)
    const carapace = this.add.ellipse(28, -10, 56, 40, 0x2e2a22).setAlpha(0.85)

    // Eight eyes, two ragged rows — slitted while it sleeps.
    this.monsterEyes = []
    const eyeRows = [-8, 4]
    for (const row of eyeRows) {
      for (let i = 0; i < 4; i++) {
        const ex = -28 + i * 16 + (row > 0 ? 6 : 0)
        const eye = this.add.ellipse(ex, row, 5, 1.5, 0xcfd6c0).setAlpha(0.9)
        this.monsterEyes.push(eye as unknown as Phaser.GameObjects.Arc)
      }
    }

    const label = this.add
      .text(0, -44, '????', { fontSize: '9px', fontFamily: 'monospace', color: '#7a8a6a' })
      .setOrigin(0.5, 1)
      .setAlpha(0.5)

    this.monsterContainer = this.add.container(wx, wy, [mound, body, furTexture, carapace, ...this.monsterEyes, label])
    this.monsterContainer.setDepth(4)

    // Slow, heavy breathing — the tell that it's deeply asleep.
    this.monsterBreathTween = this.tweens.add({
      targets: this.monsterContainer,
      scaleX: 1.04,
      scaleY: 0.97,
      duration: 2600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  // Snap the eyes from sleeping slits to wide-open circles — the visual beat
  // for "it's awake," held through the chase.
  private wakeMonster() {
    this.monsterBreathTween?.stop()
    for (const eye of this.monsterEyes) {
      this.tweens.add({ targets: eye, scaleY: 4, duration: 220, ease: 'Quad.easeOut' })
    }
    this.tweens.add({
      targets: this.monsterContainer,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
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
    const { x1: dx1, x2: dx2 } = PASS_D
    const { y1: ey1, y2: ey2 } = PASS_E
    const pad = 12

    // Generous corridor bands spanning both sides of each seam.
    const inNorthCorridor = wx >= nx1 && wx <= nx2 && wy >= 540 && wy <= 660
    const inDeepCorridor  = wx >= dx1 && wx <= dx2 && wy >= -60 && wy <= 60
    const inEastCorridor  = wy >= ey1 && wy <= ey2 && wx >= 740 && wx <= 860

    if (this.currentRoom === 'deep') {
      if (inDeepCorridor) {
        // If the chamber was cleared the door is open — snap through into north.
        // If escaped, stop just short so the refusal can fire.
        return { x: clamp(wx, dx1 + 8, dx2 - 8), y: this.roomOpen() ? 40 : -25 }
      }
      if (wx >= pad && wx <= 800 - pad && wy >= -600 + pad && wy <= -pad)
        return { x: wx, y: wy }
      return null
    }
    if (this.currentRoom === 'center') {
      if (inNorthCorridor) return { x: clamp(wx, nx1 + 8, nx2 - 8), y: 560 } // into north
      if (inEastCorridor)  return { x: 840, y: clamp(wy, ey1 + 8, ey2 - 8) } // into east
      if (wx >= pad && wx <= 800 - pad && wy >= 600 + pad && wy <= 1200 - pad)
        return { x: wx, y: wy }
      return null
    }
    if (this.currentRoom === 'north') {
      if (inNorthCorridor) return { x: clamp(wx, nx1 + 8, nx2 - 8), y: 640 } // into center
      // Once cleared, the north passage to the deep room is open.
      if (this.roomOpen() && inDeepCorridor)
        return { x: clamp(wx, dx1 + 8, dx2 - 8), y: -40 } // into deep
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
    const { x1: dx1, x2: dx2 } = PASS_D
    const { y1: ey1, y2: ey2 } = PASS_E

    if (this.currentRoom === 'deep') {
      if (py >= 0 && px >= dx1 - 10 && px <= dx2 + 10) {
        if (this.roomOpen()) {
          this.enterRoom('north', 400, 40) // door open — walk back into the chamber
        }
      } else if (this.goblinOutcome === 'escaped' && py >= -30 && px >= dx1 - 10 && px <= dx2 + 10) {
        // Goblins still alive behind you: refuse, and stop short.
        this.moveTarget = null
        this.player.setPosition(this.player.x, -70)
        window.__rpgCallbacks?.openRefusal()
      }
    } else if (this.currentRoom === 'center') {
      if (py <= 600 && px >= nx1 - 10 && px <= nx2 + 10) {
        this.enterRoom('north', 400, 560)
      } else if (px >= 800 && py >= ey1 - 10 && py <= ey2 + 10) {
        this.enterRoom('east', 840, 900)
      }
    } else if (this.currentRoom === 'north') {
      if (py >= 600 && px >= nx1 - 10 && px <= nx2 + 10) {
        this.enterRoom('center', 400, 640)
      } else if (this.roomOpen() && py <= 0 && px >= dx1 - 10 && px <= dx2 + 10) {
        this.enterRoom('deep', 400, -40) // cleared — north passage open to the deep
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

  // ── Monster chase choreography ───────────────────────────────────────────────
  // Each leg physically carries the player (and the monster, staggered close
  // behind) across a room boundary, timed to land roughly with its dialogue
  // beat. Driven through aTween/aLater so a click can fast-forward it.

  private animChaseWake() {
    this.wakeMonster()
    this.aTween({ targets: this.monsterContainer, x: this.monsterContainer.x - 26, duration: 240, ease: 'Quad.easeOut', yoyo: true })
    this.aTween({ targets: this.player, x: this.player.x - 16, duration: 200, ease: 'Quad.easeOut', yoyo: true })
  }

  private animChaseEast() {
    // Break for the passage out of the east room — monster surging up close behind.
    this.aTween({ targets: this.player, x: 800, y: 900, duration: 520, ease: 'Sine.easeIn' })
    this.aTween({ targets: this.monsterContainer, x: 960, y: 920, duration: 560, ease: 'Sine.easeIn' })
    this.aLater(440, () => this.enterRoom('center', 760, 900))
  }

  private animChaseCenter() {
    // Cut across the open floor of the center room toward the north passage.
    this.aTween({ targets: this.player, x: 400, y: 620, duration: 560, ease: 'Sine.easeIn' })
    this.aTween({ targets: this.monsterContainer, x: 560, y: 720, duration: 600, ease: 'Sine.easeIn' })
    this.aLater(480, () => this.enterRoom('north', 400, 560))
  }

  private animChaseArrival() {
    // Burst into the firelit chamber — the goblins scatter from the doorway.
    this.aTween({ targets: this.player, x: 380, y: 470, duration: 420, ease: 'Sine.easeOut' })
    this.aTween({ targets: this.monsterContainer, x: 410, y: 380, duration: 480, ease: 'Sine.easeOut' })
  }

  // ── Goblin proximity trigger ─────────────────────────────────────────────────

  private checkGoblinTrigger() {
    if (this.goblinTriggered || this.goblinDone || this.currentRoom !== 'north') return

    // Trigger box spans the full width of the north room and 90% of its height,
    // measured from the top — so the player can't slip past the goblins. Only
    // the bottom 10% (the entry strip nearest the passage) is safe.
    const boxBottom = 600 * 0.9 // y = 540
    if (this.player.y <= boxBottom) {
      this.goblinTriggered = true
      this.moveTarget = null
      window.__rpgCallbacks?.startScenario('goblin_start', 'goblin')
    }
  }

  // ── Monster proximity trigger ────────────────────────────────────────────────

  private checkMonsterTrigger() {
    if (this.monsterTriggered || this.monsterDone || this.currentRoom !== 'east') return

    const dx = this.player.x - this.monsterContainer.x
    const dy = this.player.y - this.monsterContainer.y
    if (Math.sqrt(dx * dx + dy * dy) <= 130) {
      this.monsterTriggered = true
      this.moveTarget = null
      window.__rpgCallbacks?.startScenario('monster_start', 'monster')
    }
  }

  // ── Warp (called from React on a warpSignal) ─────────────────────────────────

  warpTo(target: string) {
    // Any warp fired while the monster encounter is mid-flight concludes it
    // (the chase only ever resolves via a warp).
    if (this.monsterTriggered && !this.monsterDone && target !== 'monster_stay') {
      this.monsterDone = true
    }
    this.moveTarget = null
    this.player.setAlpha(1).setScale(1).setAngle(0) // undo any in-scene fade/shrink
    // Cancel any in-flight focus-cam pan, or it would override centerOn below
    // and drag the camera back to the chamber after we warp away.
    this.cameras.main.panEffect.reset()

    if (target === 'center') {
      // Withdrawal, or the chase circling back — encounter is unresolved/over.
      // Reset the goblin trigger so a fresh approach is still possible.
      this.goblinTriggered = false
      this.currentRoom = 'center'
      this.player.setPosition(ROOM_CAMERA.center.x, ROOM_CAMERA.center.y)
      this.cameras.main.centerOn(ROOM_CAMERA.center.x, ROOM_CAMERA.center.y)
      return
    }

    if (target === 'monster_stay') {
      // Backed away without disturbing it — stays asleep, room revisitable.
      this.monsterTriggered = false
      return
    }

    if (target === 'north') {
      // The chase dumps the player straight into the goblin chamber — the
      // goblin proximity trigger is suppressed since the arrival itself (with
      // the monster on the player's heels) already played out in the chase.
      this.monsterTriggered = true
      this.monsterDone = true
      this.goblinTriggered = true
      this.currentRoom = 'north'
      this.player.setPosition(400, 520)
      this.cameras.main.centerOn(ROOM_CAMERA.north.x, ROOM_CAMERA.north.y)
      return
    }

    this.goblinDone = true
    this.goblinTriggered = true

    if (target === 'deep') {
      // Escaped/talked past — the goblins are still alive behind you. Warp into
      // the deep room; the chamber becomes one-way (refusal on re-entry).
      this.goblinOutcome = 'escaped'
      this.currentRoom = 'deep'
      this.player.setPosition(ROOM_CAMERA.deep.x, ROOM_CAMERA.deep.y)
      this.cameras.main.centerOn(ROOM_CAMERA.deep.x, ROOM_CAMERA.deep.y)
    } else if (target === 'cleared') {
      // Killed all three — stay in the chamber. Replace the goblins with
      // splatters and leave the player free to roam (north passage now open).
      this.goblinOutcome = 'cleared'
      this.currentRoom = 'north'
      this.clearGoblins()
      // Camera is already on the north room; no recenter needed.
    } else if (target === 'emptied') {
      // Drove the goblins out alive — stay in the chamber, no bodies, free to
      // roam and re-enter. Remove any goblins still present (no splatter).
      this.goblinOutcome = 'fled'
      this.currentRoom = 'north'
      this.removeGoblins()
    }
  }

  // Destroy any remaining goblin tokens without leaving splatters.
  private removeGoblins() {
    for (const c of this.aliveGoblins) { this.tweens.killTweensOf(c); c.destroy() }
    this.aliveGoblins = []
    this.goblinContainers = []
  }

  // The chamber is freely traversable once the goblins are gone (killed or fled),
  // as opposed to 'escaped' where they're still alive and re-entry is refused.
  private roomOpen() {
    return this.goblinOutcome === 'cleared' || this.goblinOutcome === 'fled'
  }

  // Replace any remaining goblin tokens with red splatters where they stand.
  // Idempotent: the kill animation may already have splattered them.
  private clearGoblins() {
    const g = this.splatterGfx ?? this.add.graphics().setDepth(3)
    this.splatterGfx = g
    const remaining = [...this.aliveGoblins]
    this.aliveGoblins = []
    for (const c of remaining) {
      this.tweens.killTweensOf(c)
      this.drawSplatterBlob(g, c.x, c.y)
      c.destroy()
    }
    this.goblinContainers = []
  }

  // Draw one blood splatter at a point.
  private drawSplatterBlob(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x6e1410, 0.9)
    g.fillCircle(x, y, 13)
    g.fillStyle(0x8a1a12, 0.85)
    g.fillCircle(x - 7, y + 4, 8)
    g.fillCircle(x + 9, y - 3, 6)
    g.fillStyle(0x5a0f0c, 0.8)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + x
      const r = 18 + (i % 3) * 6
      g.fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r, 2 + (i % 2))
    }
  }

  // ── Goblin-scenario animation ────────────────────────────────────────────────
  // Driven from React whenever currentNodeId changes while in dialogue. A small
  // dispatcher picks an animation per node from the dialogue graph + keywords.

  // Register an *action* tween: tracked so a click can complete it early, and
  // self-removed from the registry when it finishes.
  private aTween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    const userDone = cfg.onComplete
    const tween = this.tweens.add({
      ...cfg,
      onComplete: (t, targets, ...rest) => {
        this.actionTweens.delete(t)
        ;(userDone as ((...a: unknown[]) => void) | undefined)?.(t, targets, ...rest)
      },
    })
    this.actionTweens.add(tween)
    return tween
  }

  // Register an *action* delayed call so fast-forward can fire it immediately.
  private aLater(ms: number, cb: () => void) {
    const timer = this.time.delayedCall(ms, () => {
      this.actionTimers.delete(timer)
      cb()
    })
    this.actionTimers.add(timer)
    return timer
  }

  // Snap every in-flight action tween/timer to its end. Pending timers fire
  // first (they may spawn the next tween), then tweens complete; we flush in a
  // bounded loop because completions/timers can chain further steps.
  fastForwardAnims() {
    let guard = 0
    while (
      guard++ < 24 &&
      (this.actionTimers.size > 0 ||
        [...this.actionTweens].some((t) => t.isPlaying() || t.isPaused()))
    ) {
      this.actionTimers.forEach((timer) => {
        const cb = timer.callback as (() => void) | undefined
        const scope = timer.callbackScope
        this.actionTimers.delete(timer)
        timer.remove(false)
        cb?.call(scope)
      })
      this.actionTweens.forEach((t) => {
        if (t.isPlaying() || t.isPaused()) t.complete()
      })
    }
    this.actionTweens.clear()
    this.actionTimers.clear()
  }

  // Beat-timed animations: fired when a specific beat is revealed (not at node
  // entry), so the motion lands on the line that describes it.
  playBeatAnim(name: string) {
    switch (name) {
      case 'poisonStew':
        return this.animPoisonStew()
      case 'sneakForward':
        return this.animSneak()
      case 'strike':
        return this.animFight()
      case 'flee':
        return this.animFlee()
    }
  }

  playNodeAnim(id: string) {
    if (id.startsWith('monster_')) {
      if (id === 'monster_start' || id === 'monster_observe' || id === 'monster_retreat') return this.animObserve()
      if (id === 'monster_attack_open') return this.animChaseWake()
      if (id === 'monster_chase_east') return this.animChaseEast()
      if (id === 'monster_chase_center') return this.animChaseCenter()
      if (id === 'monster_chase_arrival') return this.animChaseArrival()
      return
    }
    if (!id.startsWith('goblin_')) return
    // Terminal/meta nodes are handled by the warp + refusal, not animated here.
    if (id === 'goblin_exit' || id === 'goblin_cleared' || id === 'goblin_fled' || id === 'goblin_refuse') return

    this.setupGoblinScene()
    this.stopOrbTweens()

    if (KILL_NODES.has(id)) return this.animKill()
    if (FLED_NODES.has(id)) return this.animGoblinsFlee()
    if (id === 'goblin_ambush_success') return this.animAmbushKill()
    if (id === 'goblin_fight_won_wit') return this.animFlee()
    // Truce: the goblins step aside and let you walk the road, not a flee.
    if (id === 'goblin_truce_success') return this.animTrucePass()
    if (FLEE_NODES.has(id)) return this.animFlee()
    if (id.includes('death')) return this.animCollapse()
    // Caught, then choosing to rise into the light — a confront, not the jolt.
    if (id === 'goblin_spotted_stand') return this.animConfront()
    if (id.includes('caught') || id.includes('spotted')) return this.animSpotted()
    // Two-goblin standoff vs. the full three-goblin encircle.
    if (id === 'goblin_cornered_two') return this.animConvergeTwo()
    if (id.includes('cornered')) return this.animEncircle()

    // ── Bespoke combat staging — each reads the node's tactical moment ──────────
    if (id === 'goblin_fight3_r1') return this.animFightOpen()
    if (id === 'goblin_fight3_r2') return this.animStackBole()
    if (id === 'goblin_fight3_r2_hurt' || id === 'goblin_fight2_r2_hurt') return this.animPlayerHit()
    if (id === 'goblin_fight3_r3_hurt') return this.animConverge()
    if (id === 'goblin_fight_brace') return this.animBrace()
    if (id === 'goblin_fight_spit') return this.animGrabSpit()
    if (id === 'goblin_fight_feign') return this.animFeign()
    if (id === 'goblin_ambush_fail') return this.animAmbushFail()
    if (id === 'goblin_ambush_overextended') return this.animOverextend()
    // The corpse-veil bursts between Fiodor and the goblins — not in the fire.
    if (id === 'goblin_mushroom2' || id === 'goblin_mushroom3') return this.animSporeBurst()
    // Mid-fight talk and the negotiation curdling: the room holds its breath at
    // the edge of violence.
    if (id.startsWith('goblin_fight_talk') || id === 'goblin_fight_bole_appeal' || id === 'goblin_fight_bole_plea') return this.animHold()
    if (id === 'goblin_truce_open' || id === 'goblin_truce_fail' || id === 'goblin_talk_collapse') return this.animHold()
    // The wordless read: the room freezes mid-breath while the player decides
    // what to do with the half-second the silence bought.
    if (id === 'goblin_menace_read') return this.animHold()
    if (id === 'goblin_menace_standoff') return this.animTrucePass()
    if (id === 'goblin_menace_strike_open' || id === 'goblin_menace_strike_won') return this.animFight()
    if (id === 'goblin_scout_passage' || id === 'goblin_scout_noise') return this.animObserve()
    if (id === 'goblin_distract_success' || id === 'goblin_distract_fail') return this.animSneak()

    if (id.includes('ambush') || id.includes('fight')) return this.animFight() // generic fallback
    if (id.includes('divide')) return this.animDivide()
    // The poison action is beat-timed (see playBeatAnim); at entry this node
    // just holds the ambient fireside framing.
    if (id === 'goblin_poison_success') return this.animObserve()
    if (id.includes('sneak') || id.includes('slip')) return this.animSneak()
    // Producing the grey handful as a bribe — held out, not thrown.
    if (id.includes('bribe')) return this.animOffer()
    if (id === 'goblin_start' || id === 'goblin_approach' || id === 'goblin_observe') return this.animObserve()
    if (id.includes('confront') || id.endsWith('_open')) return this.animConfront()
    return this.animBanter()
  }

  // First entry into the scenario: stop the idle pace, snap the cast into the
  // fireside tableau, and frame the north room.
  private setupGoblinScene() {
    if (this.goblinSceneReady) return
    this.goblinSceneReady = true
    this.tweens.killTweensOf([this.gritContainer, this.nimContainer, this.boleContainer])
    this.cameras.main.centerOn(ROOM_CAMERA.north.x, ROOM_CAMERA.north.y)
    this.gritContainer.setPosition(GOBLIN_HOME.grit.x, GOBLIN_HOME.grit.y)
    this.nimContainer.setPosition(GOBLIN_HOME.nim.x, GOBLIN_HOME.nim.y)
    this.boleContainer.setPosition(GOBLIN_HOME.bole.x, GOBLIN_HOME.bole.y)
    this.aliveGoblins = [this.gritContainer, this.nimContainer, this.boleContainer]
    this.player.setPosition(PLAYER_DARK.x, PLAYER_DARK.y).setAlpha(0.85)
  }

  private stopOrbTweens() {
    this.tweens.killTweensOf([this.player, ...this.aliveGoblins])
    // Normalise transforms so a killed yoyo/pulse doesn't leave odd scales.
    this.player.setScale(1).setAngle(0)
    this.aliveGoblins.forEach((g) => g.setScale(1))
  }

  // A looping in-place hop — the visual language of banter.
  private hop(orb: Phaser.GameObjects.Container, h = 8, dur = 300) {
    this.tweens.add({
      targets: orb, y: orb.y - h, duration: dur,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  // ── Individual animations ─────────────────────────────────────────────────────

  private animObserve() {
    this.tweens.add({ targets: this.player, x: PLAYER_DARK.x, y: PLAYER_DARK.y, alpha: 0.55, duration: 400 })
    // Snap any surviving goblins back to the fireside tableau (covers a fresh
    // start and a post-death restart).
    const homes: Array<[Phaser.GameObjects.Container, { x: number; y: number }]> = [
      [this.gritContainer, GOBLIN_HOME.grit],
      [this.nimContainer, GOBLIN_HOME.nim],
      [this.boleContainer, GOBLIN_HOME.bole],
    ]
    for (const [c, h] of homes) if (this.aliveGoblins.includes(c)) c.setPosition(h.x, h.y)
    this.animBanter()
  }

  private animBanter() {
    // GRIT paces; NIM and BOLE squabble in place.
    if (this.aliveGoblins.includes(this.gritContainer)) {
      this.tweens.add({
        targets: this.gritContainer, x: this.gritContainer.x + 28, duration: 1900,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }
    if (this.aliveGoblins.includes(this.nimContainer)) this.hop(this.nimContainer, 7, 300)
    if (this.aliveGoblins.includes(this.boleContainer)) this.hop(this.boleContainer, 10, 360)
  }

  private animConfront() {
    this.tweens.add({ targets: this.player, x: PLAYER_FIRE.x, y: PLAYER_FIRE.y, alpha: 1, duration: 600, ease: 'Sine.easeInOut' })
    // The goblins flinch back a step, then settle into wary banter.
    this.aliveGoblins.forEach((g, i) => {
      this.tweens.add({ targets: g, y: g.y - 7, duration: 170, yoyo: true, delay: i * 60 })
    })
    this.time.delayedCall(450, () => this.animBanter())
  }

  private animSneak() {
    // Creep, dimmed, up the left edge toward the onward passage.
    this.player.setAlpha(0.5)
    this.tweens.add({ targets: this.player, x: 130, y: 250, duration: 1600, ease: 'Sine.easeInOut' })
    this.animBanter()
  }

  private animSpotted() {
    this.player.setAlpha(1)
    // Player flinches; goblins jolt and snap toward the player.
    this.tweens.add({ targets: this.player, y: this.player.y + 16, duration: 110, yoyo: true })
    this.aliveGoblins.forEach((g, i) => {
      this.tweens.add({ targets: g, scaleX: 1.3, scaleY: 1.3, duration: 110, yoyo: true, delay: i * 40 })
      this.tweens.add({
        targets: g,
        x: g.x + (this.player.x - g.x) * 0.18,
        y: g.y + (this.player.y - g.y) * 0.18,
        duration: 320, delay: 120, ease: 'Quad.easeOut',
      })
    })
  }

  private animEncircle() {
    this.tweens.add({ targets: this.player, x: ENCIRCLE.x, y: ENCIRCLE.y, alpha: 1, duration: 420, ease: 'Sine.easeInOut' })
    const n = this.aliveGoblins.length || 1
    this.aliveGoblins.forEach((g, i) => {
      const ang = -Math.PI / 2 + i * ((2 * Math.PI) / n)
      const gx = ENCIRCLE.x + Math.cos(ang) * ENCIRCLE.r
      const gy = ENCIRCLE.y + Math.sin(ang) * ENCIRCLE.r
      this.tweens.add({
        targets: g, x: gx, y: gy, duration: 520, delay: i * 70, ease: 'Sine.easeInOut',
        onComplete: () => {
          this.tweens.add({ targets: g, scaleX: 1.12, scaleY: 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        },
      })
    })
  }

  private animFight() {
    this.player.setAlpha(1)
    if (this.aliveGoblins.length === 0) return
    const g = this.aliveGoblins[Math.floor(Math.random() * this.aliveGoblins.length)]
    this.bump(this.player, g)
    this.time.delayedCall(220, () => this.bump(g, this.player))
    this.time.delayedCall(120, () => this.cameras.main.shake(120, 0.006))
  }

  // A short lunge: `a` darts at `b` and recoils.
  private bump(a: Phaser.GameObjects.Container | Phaser.GameObjects.Arc, b: Phaser.GameObjects.Container | Phaser.GameObjects.Arc) {
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.hypot(dx, dy) || 1
    this.tweens.add({
      targets: a,
      x: b.x - (dx / d) * 16,
      y: b.y - (dy / d) * 16,
      duration: 140, yoyo: true, ease: 'Quad.easeIn',
    })
  }

  // ── Combat staging helpers ─────────────────────────────────────────────────────

  // Move one named goblin into a combat slot, if it's still alive.
  private placeGoblin(c: Phaser.GameObjects.Container, pos: { x: number; y: number }, delay: number, dur: number, ease = 'Sine.easeInOut') {
    if (!this.aliveGoblins.includes(c)) return
    this.aTween({ targets: c, x: pos.x, y: pos.y, duration: dur, delay, ease })
  }

  // Snap the cast into the squared-up fighting formation: player below, the
  // three goblins fanned to BOLE-centre / NIM-left / GRIT-right (dead ones skip).
  private formUp(dur = 420) {
    this.player.setAlpha(1)
    this.aTween({ targets: this.player, x: COMBAT.player.x, y: COMBAT.player.y, duration: dur, ease: 'Sine.easeInOut' })
    this.placeGoblin(this.boleContainer, COMBAT.bole, 0, dur)
    this.placeGoblin(this.nimContainer, COMBAT.nim, 0, dur)
    this.placeGoblin(this.gritContainer, COMBAT.grit, 0, dur)
  }

  // `a` drives in to within `depth` of `b` and snaps back — a landed blow.
  private lungeInto(a: Phaser.GameObjects.Container, b: Phaser.GameObjects.Arc, depth: number, dur: number) {
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.hypot(dx, dy) || 1
    this.aTween({
      targets: a,
      x: a.x + (dx / d) * (d - depth),
      y: a.y + (dy / d) * (d - depth),
      duration: dur, yoyo: true, ease: 'Quad.easeIn',
    })
  }

  // A red bloom over the player — a wound landing.
  private flashWound() {
    const f = this.add.circle(this.player.x, this.player.y, 15, 0xc0392b, 0.6).setDepth(7)
    this.aTween({ targets: f, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 380, ease: 'Quad.easeOut', onComplete: () => f.destroy() })
  }

  // A slow, tense breathing pulse on the living goblins — a held standoff.
  private menacePulse() {
    this.aliveGoblins.forEach((g, i) =>
      this.tweens.add({ targets: g, scaleX: 1.07, scaleY: 1.07, duration: 640, yoyo: true, repeat: -1, delay: i * 130, ease: 'Sine.easeInOut' }))
  }

  // ── Bespoke combat moments ─────────────────────────────────────────────────────

  // r1: the big one comes first; the other two slide wide to take the flanks.
  private animFightOpen() {
    this.formUp(480)
    this.aLater(520, () => {
      const b = this.boleContainer
      if (this.aliveGoblins.includes(b)) this.aTween({ targets: b, y: b.y + 22, duration: 300, yoyo: true, ease: 'Quad.easeInOut' })
    })
  }

  // r2: BOLE overcommits; the player slips aside and stacks him between you and
  // the other two — for a breath it's one-on-one.
  private animStackBole() {
    this.player.setAlpha(1)
    this.aTween({ targets: this.player, x: COMBAT.player.x - 78, y: COMBAT.player.y, duration: 380, ease: 'Quad.easeOut' })
    const b = this.boleContainer
    if (this.aliveGoblins.includes(b)) this.aTween({ targets: b, x: COMBAT.player.x - 36, y: COMBAT.player.y - 6, duration: 440, ease: 'Quad.easeIn' })
    // the other two are stalled on the far side of BOLE, away from the player
    this.placeGoblin(this.nimContainer, { x: 430, y: 360 }, 0, 500)
    this.placeGoblin(this.gritContainer, { x: 480, y: 356 }, 0, 500)
  }

  // r2_hurt / fight2_r2_hurt: a blade you didn't track lands and folds you back
  // toward the fire.
  private animPlayerHit() {
    this.formUp(260)
    const attacker = this.aliveGoblins.includes(this.nimContainer) ? this.nimContainer : this.aliveGoblins[0]
    if (!attacker) return
    this.aLater(280, () => {
      this.lungeInto(attacker, this.player, 14, 150)
      this.aLater(110, () => {
        this.flashWound()
        this.cameras.main.shake(170, 0.008)
        // folded back toward the fire (upward)
        this.aTween({ targets: this.player, y: this.player.y - 24, duration: 170, yoyo: true, ease: 'Quad.easeOut' })
      })
    })
  }

  // r3_hurt: all three on you at once, the fire at your back.
  private animConverge() {
    this.player.setAlpha(1)
    this.aTween({ targets: this.player, x: PLAYER_FIRE.x, y: PLAYER_FIRE.y, duration: 360, ease: 'Sine.easeInOut' })
    const n = this.aliveGoblins.length || 1
    this.aliveGoblins.forEach((g, i) => {
      const ang = -Math.PI / 2 + i * ((2 * Math.PI) / n)
      const gx = PLAYER_FIRE.x + Math.cos(ang) * 56
      const gy = PLAYER_FIRE.y + Math.sin(ang) * 56
      this.aTween({
        targets: g, x: gx, y: gy, duration: 440, delay: i * 60, ease: 'Quad.easeIn',
        onComplete: () => this.tweens.add({ targets: g, scaleX: 1.1, scaleY: 1.1, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      })
    })
  }

  // brace: back to the wall, the fire and rubble covering the flanks; two angles
  // instead of three.
  private animBrace() {
    this.player.setAlpha(1)
    this.aTween({ targets: this.player, x: COMBAT.playerWall.x, y: COMBAT.playerWall.y, duration: 520, ease: 'Sine.easeInOut' })
    this.placeGoblin(this.boleContainer, { x: 360, y: 372 }, 0, 520)
    this.placeGoblin(this.nimContainer, { x: 330, y: 430 }, 80, 520)
    this.placeGoblin(this.gritContainer, { x: 420, y: 410 }, 0, 520)
    this.aLater(580, () => this.menacePulse())
  }

  // spit: dart to the fire, take the burning brand, drive them back from the heat.
  private animGrabSpit() {
    this.player.setAlpha(1)
    this.aTween({
      targets: this.player, x: FIRE_POS.x, y: FIRE_POS.y + 36, duration: 320, ease: 'Quad.easeOut',
      onComplete: () => {
        const flare = this.add.circle(FIRE_POS.x, FIRE_POS.y + 24, 7, 0xff9030, 0.95).setDepth(7)
        this.aTween({ targets: flare, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 520, onComplete: () => flare.destroy() })
        this.aTween({ targets: this.player, x: COMBAT.player.x, y: COMBAT.player.y, duration: 340, delay: 100, ease: 'Sine.easeInOut' })
      },
    })
    // the goblins pull back from the arm of fire
    this.aliveGoblins.forEach((g, i) => {
      const dir = g.x < FIRE_POS.x ? -1 : 1
      this.aTween({ targets: g, x: g.x + dir * 28, y: g.y - 16, duration: 380, delay: 220 + i * 50, ease: 'Quad.easeOut' })
    })
  }

  // feign: sell more damage than there is — one pulls up, then NIM reads it and
  // they all close.
  private animFeign() {
    this.player.setAlpha(1)
    const baseY = this.player.y
    this.aTween({
      targets: this.player, y: baseY + 18, scaleX: 0.9, scaleY: 0.82, angle: -8, duration: 300, ease: 'Quad.easeOut',
      onComplete: () => this.aTween({ targets: this.player, y: baseY, scaleX: 1, scaleY: 1, angle: 0, duration: 240, delay: 260, ease: 'Quad.easeIn' }),
    })
    const b = this.boleContainer
    if (this.aliveGoblins.includes(b)) this.aTween({ targets: b, y: b.y - 10, duration: 200, yoyo: true, delay: 120 })
    // then they surge a step in
    this.aLater(560, () => this.aliveGoblins.forEach((g, i) => this.aTween({ targets: g, y: g.y + 22, duration: 240, delay: i * 40, ease: 'Quad.easeIn' })))
  }

  // mid-fight talk: the room holds its breath at the edge of violence.
  private animHold() {
    this.player.setAlpha(1)
    this.menacePulse()
  }

  // ambush_fail: GRIT turns into your charge; all three jolt awake and form a
  // line across the way out.
  private animAmbushFail() {
    this.player.setAlpha(1)
    this.aTween({ targets: this.player, x: COMBAT.player.x, y: COMBAT.player.y + 26, duration: 300, ease: 'Quad.easeOut' })
    this.aliveGoblins.forEach((g, i) => this.aTween({ targets: g, scaleX: 1.25, scaleY: 1.25, duration: 110, yoyo: true, delay: i * 40 }))
    const line = [{ x: 300, y: 358 }, { x: 400, y: 348 }, { x: 500, y: 358 }]
    this.aliveGoblins.forEach((g, i) => this.aTween({ targets: g, x: line[i % 3].x, y: line[i % 3].y, duration: 420, delay: 160 + i * 60, ease: 'Quad.easeOut' }))
  }

  // ambush_overextended: the strike sticks; your weight commits and NIM slips
  // inside the guard before you can recover.
  private animOverextend() {
    this.player.setAlpha(1)
    this.aTween({
      targets: this.player, x: FIRE_POS.x, y: FIRE_POS.y + 48, scaleX: 1.2, scaleY: 0.86, duration: 300, ease: 'Quad.easeIn',
      onComplete: () => this.aTween({ targets: this.player, x: COMBAT.player.x, y: COMBAT.player.y, scaleX: 1, scaleY: 1, duration: 520, delay: 420, ease: 'Sine.easeInOut' }),
    })
    const nim = this.nimContainer
    if (this.aliveGoblins.includes(nim)) this.aTween({ targets: nim, x: FIRE_POS.x - 12, y: FIRE_POS.y + 70, duration: 360, delay: 260, ease: 'Quad.easeIn' })
    const bole = this.boleContainer
    if (this.aliveGoblins.includes(bole)) this.aTween({ targets: bole, x: 432, y: 332, duration: 420, delay: 320, ease: 'Sine.easeInOut' })
  }

  // cornered_two: NIM and BOLE spread wide and come in low.
  private animConvergeTwo() {
    this.player.setAlpha(1)
    this.aTween({ targets: this.player, x: COMBAT.player.x, y: COMBAT.player.y, duration: 380, ease: 'Sine.easeInOut' })
    this.placeGoblin(this.nimContainer, { x: 320, y: 408 }, 60, 480)
    this.placeGoblin(this.boleContainer, { x: 480, y: 408 }, 0, 480)
    this.aLater(520, () => this.menacePulse())
  }

  // The corpse-veil hurled into the space between you and them: it bursts into a
  // pale spore cloud and the goblins recoil from the dead-smell and freeze.
  private animSporeBurst() {
    this.player.setAlpha(1)
    const burst = { x: 400, y: 396 }
    const proj = this.add.circle(this.player.x, this.player.y, 5, 0xb8b89a).setDepth(7)
    this.aTween({
      targets: proj, x: burst.x, y: burst.y, duration: 300, ease: 'Quad.easeOut',
      onComplete: () => {
        proj.destroy()
        const cloud = this.add.circle(burst.x, burst.y, 8, 0xcfc8b0, 0.55).setDepth(6)
        this.aTween({ targets: cloud, scaleX: 9, scaleY: 7, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => cloud.destroy() })
        this.aliveGoblins.forEach((g, i) => {
          const dir = g.x < burst.x ? -1 : 1
          this.aTween({
            targets: g, x: g.x + dir * 26, y: g.y - 30, duration: 420, delay: i * 60, ease: 'Quad.easeOut',
            onComplete: () => this.tweens.add({ targets: g, scaleX: 0.94, scaleY: 0.94, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
          })
        })
      },
    })
  }

  // Producing the grey handful as a bribe — brought out slow and held forward,
  // not thrown. The goblins lean in, wary.
  private animOffer() {
    this.aTween({ targets: this.player, x: PLAYER_FIRE.x, y: PLAYER_FIRE.y, alpha: 1, duration: 500, ease: 'Sine.easeInOut' })
    const orb = this.add.circle(PLAYER_FIRE.x, PLAYER_FIRE.y - 18, 5, 0xb8b89a, 0).setDepth(7)
    this.aTween({ targets: orb, alpha: 1, y: orb.y - 10, duration: 600, delay: 300, ease: 'Sine.easeOut' })
    this.aLater(720, () => this.aliveGoblins.forEach((g, i) => this.aTween({ targets: g, y: g.y + 8, duration: 300, yoyo: true, delay: i * 50 })))
    this.aLater(2000, () => orb.destroy())
  }

  private animDivide() {
    // Player edges toward the passage; NIM and BOLE round on each other.
    this.tweens.add({ targets: this.player, x: 175, y: 300, alpha: 0.9, duration: 900, ease: 'Sine.easeInOut' })
    const nim = this.nimContainer, bole = this.boleContainer
    if (this.aliveGoblins.includes(nim)) {
      this.tweens.add({ targets: nim, x: 345, y: 360, duration: 500, ease: 'Sine.easeInOut', onComplete: () => this.hop(nim, 11, 220) })
    }
    if (this.aliveGoblins.includes(bole)) {
      this.tweens.add({ targets: bole, x: 445, y: 360, duration: 500, ease: 'Sine.easeInOut', onComplete: () => this.hop(bole, 11, 220) })
    }
  }

  private animPoisonStew() {
    // Player creeps dimly to the fire, works the mushroom into the meat, then retreats.
    const savedX = this.player.x
    const savedY = this.player.y
    const savedAlpha = this.player.alpha
    // Dim the player to convey stealth.
    this.aTween({ targets: this.player, alpha: 0.5, duration: 200 })
    // Creep to the fire.
    this.aTween({
      targets: this.player, x: FIRE_POS.x, y: FIRE_POS.y + 30, duration: 900, ease: 'Sine.easeInOut',
      onComplete: () => {
        // Brief interaction: pulse at the fire.
        const glow = this.add.circle(FIRE_POS.x, FIRE_POS.y + 10, 8, 0x6fa84a, 0.7).setDepth(6)
        this.aTween({ targets: glow, alpha: 0, scaleX: 2, scaleY: 2, duration: 500,
          onComplete: () => glow.destroy() })
        // Retreat into shadow after the interaction.
        this.aTween({
          targets: this.player, x: savedX, y: savedY, duration: 850, ease: 'Sine.easeInOut', delay: 450,
          onComplete: () => this.aTween({ targets: this.player, alpha: savedAlpha, duration: 300 }),
        })
      },
    })
    // Goblins remain oblivious — banter as usual.
    this.animBanter()
  }

  // Truce granted: the goblins step aside — deliberate, unafraid — and Fiodor
  // walks the road slow and open. The calm counterpart to animFlee.
  private animTrucePass() {
    this.player.setAlpha(1)
    this.aliveGoblins.forEach((g, i) => {
      const dir = g.x < FIRE_POS.x ? -1 : 1
      this.aTween({ targets: g, x: g.x + dir * 55, duration: 600, delay: i * 70, ease: 'Sine.easeInOut' })
    })
    this.aTween({
      targets: this.player, x: PASSAGE_TOP.x, y: PASSAGE_TOP.y, duration: 1400, delay: 300, ease: 'Sine.easeInOut',
      onComplete: () => this.aTween({ targets: this.player, alpha: 0.3, duration: 300 }),
    })
  }

  private animFlee() {
    this.player.setAlpha(1)
    this.tweens.add({
      targets: this.player, x: PASSAGE_TOP.x, y: PASSAGE_TOP.y, duration: 950, ease: 'Sine.easeIn',
      onComplete: () => this.tweens.add({ targets: this.player, alpha: 0.3, duration: 300 }),
    })
    // The goblins recoil to the edges as you go.
    this.aliveGoblins.forEach((g, i) => {
      const dir = g.x < 400 ? -1 : 1
      this.tweens.add({ targets: g, x: g.x + dir * 45, duration: 420, delay: i * 50, ease: 'Quad.easeOut' })
    })
  }

  // The goblins break and bolt for the far passage; the player holds the ground.
  private animGoblinsFlee() {
    this.tweens.add({ targets: this.player, x: PLAYER_FIRE.x, y: PLAYER_FIRE.y, alpha: 1, duration: 350, ease: 'Sine.easeInOut' })
    const goblins = [...this.aliveGoblins]
    this.aliveGoblins = []
    goblins.forEach((g, i) => {
      this.tweens.add({
        targets: g,
        x: PASSAGE_TOP.x + (i - 1) * 28,
        y: -40,
        alpha: 0,
        duration: 720 + i * 120,
        delay: i * 90,
        ease: 'Quad.easeIn',
        onComplete: () => { this.tweens.killTweensOf(g); g.destroy() },
      })
    })
  }

  private animCollapse() {
    this.tweens.add({ targets: this.player, scaleX: 0.2, scaleY: 0.2, alpha: 0, angle: 90, duration: 700, ease: 'Quad.easeIn' })
  }

  // Kill all remaining goblins: lunge into each in turn, splatter it, and stay
  // — the player ends standing over the last body, not back where they started.
  private animKill() {
    this.player.setAlpha(1)
    const targets = [...this.aliveGoblins]
    this.aliveGoblins = []
    const g = this.splatterGfx ?? this.add.graphics().setDepth(3)
    this.splatterGfx = g
    targets.forEach((goblin, i) => {
      this.time.delayedCall(i * 430, () => this.strikeDown(g, goblin, 200))
    })
  }

  // Ambush: drop the pacing goblin (GRIT) in one strike, leaving the other two.
  private animAmbushKill() {
    this.player.setAlpha(1)
    const victim = this.aliveGoblins.includes(this.gritContainer) ? this.gritContainer : this.aliveGoblins[0]
    if (!victim) return
    this.aliveGoblins = this.aliveGoblins.filter((g) => g !== victim)
    const g = this.splatterGfx ?? this.add.graphics().setDepth(3)
    this.splatterGfx = g
    this.strikeDown(g, victim, 220)
  }

  // Drive the player into a goblin (no recoil), splatter it, and leave the
  // player resting beside the body.
  private strikeDown(g: Phaser.GameObjects.Graphics, goblin: Phaser.GameObjects.Container, dur: number) {
    const dx = goblin.x - this.player.x, dy = goblin.y - this.player.y
    const d = Math.hypot(dx, dy) || 1
    this.tweens.add({
      targets: this.player,
      x: goblin.x - (dx / d) * 14,
      y: goblin.y - (dy / d) * 14,
      duration: dur, ease: 'Quad.easeIn',
      onComplete: () => {
        this.cameras.main.shake(130, 0.006)
        this.drawSplatterBlob(g, goblin.x, goblin.y)
        this.tweens.killTweensOf(goblin)
        goblin.destroy()
      },
    })
  }

  // ── Focus cam ─────────────────────────────────────────────────────────────────
  // Gently drift the camera toward whoever is speaking. Player/narrator/internal
  // skill voices recenter to the room's default framing. Only active in the
  // goblin chamber (the refusal dialogue plays elsewhere).

  focusSpeaker(speaker: string) {
    if (this.currentRoom !== 'north') return
    const cx = ROOM_CAMERA.north.x
    const cy = ROOM_CAMERA.north.y

    const byName: Record<string, Phaser.GameObjects.Container> = {
      GRIT: this.gritContainer,
      NIM: this.nimContainer,
      BOLE: this.boleContainer,
    }
    const orb = byName[speaker]

    let tx = cx
    let ty = cy
    if (orb && this.aliveGoblins.includes(orb)) {
      // Drift partway toward the speaker — a nudge, not a full recenter.
      tx = cx + (orb.x - cx) * 0.4
      ty = cy + (orb.y - cy) * 0.4
    }

    this.cameras.main.pan(tx, ty, 750, 'Sine.easeInOut')
  }

  // ── Called from React wrapper on mode changes ────────────────────────────────

  setDialogueMode(active: boolean) {
    // No screen dimming — the dungeon stays fully visible behind the dialogue
    // panel. `inDialogue` still locks movement/clicks while talking.
    this.inDialogue = active
  }
}

// ── React component ──────────────────────────────────────────────────────────

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const mode = useGameStore((s) => s.gameMode)
  const startScenario = useGameStore((s) => s.startScenario)
  const openRefusal = useGameStore((s) => s.openRefusal)
  const warpSignal = useGameStore((s) => s.warpSignal)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const revealedBeats = useGameStore((s) => s.revealedBeats)

  // Wire up callbacks so the Phaser scene can reach the store
  useEffect(() => {
    window.__rpgCallbacks = {
      startScenario,
      openRefusal,
      getMode: () => useGameStore.getState().gameMode,
    }
  }, [startScenario, openRefusal])

  // Drive a warp into the scene whenever the store emits a new warp signal
  useEffect(() => {
    if (!warpSignal) return
    window.__rpgScene?.warpTo(warpSignal.target)
  }, [warpSignal])

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

  // Drive the per-node goblin animation as the conversation advances
  useEffect(() => {
    if (mode !== 'dialogue') return
    window.__rpgScene?.playNodeAnim(currentNodeId)
  }, [currentNodeId, mode])

  // Beat-timed animations: when a freshly revealed beat carries an `anim`, fire
  // it on the scene so the motion lands on that line (not at node entry).
  const prevRevealedCount = useRef(0)
  useEffect(() => {
    if (mode !== 'dialogue') {
      prevRevealedCount.current = revealedBeats.length
      return
    }
    if (revealedBeats.length > prevRevealedCount.current) {
      const fresh = revealedBeats.slice(prevRevealedCount.current)
      for (const entry of fresh) {
        if (entry.anim) window.__rpgScene?.playBeatAnim(entry.anim)
      }
    }
    prevRevealedCount.current = revealedBeats.length
  }, [revealedBeats, mode])

  // Focus cam: follow the most recently revealed speaker. The current speaker is
  // the latest revealed voice line; before any beats it's the narrator (default).
  useEffect(() => {
    if (mode !== 'dialogue') return
    let speaker = 'NARRATOR'
    for (let i = revealedBeats.length - 1; i >= 0; i--) {
      if (revealedBeats[i].type === 'interjection') {
        speaker = revealedBeats[i].speaker
        break
      }
    }
    window.__rpgScene?.focusSpeaker(speaker)
  }, [revealedBeats, currentNodeId, mode])

  return (
    <div
      ref={containerRef}
      style={{ lineHeight: 0 }}  // prevent extra space under canvas
    />
  )
}
