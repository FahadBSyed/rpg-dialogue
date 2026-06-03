import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'

class DungeonScene extends Phaser.Scene {
  private overlayRect?: Phaser.GameObjects.Rectangle

  constructor() {
    super({ key: 'DungeonScene' })
  }

  create() {
    const { width, height } = this.scale

    // Dungeon room background (already filled dark by game bg color)
    // Draw slightly lighter floor rectangle
    this.add.rectangle(width / 2, height / 2, width - 80, height - 80, 0x2a2a2a)

    // Fiodor — small white circle centered
    this.add.circle(width / 2, height / 2, 10, 0xffffff)

    // Dark overlay for dialogue mode (70% opacity)
    this.overlayRect = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
    )
    this.overlayRect.setAlpha(0.7)

    // Read mode from Zustand store via window (scenes can't import hooks directly)
    // We expose the mode via a custom event / global flag set in the React component
    const mode = (window as unknown as Record<string, unknown>).__rpgGameMode as string | undefined
    if (mode !== 'dialogue') {
      this.overlayRect.setAlpha(0)
    }
  }

  setDialogueMode(active: boolean) {
    if (this.overlayRect) {
      this.overlayRect.setAlpha(active ? 0.7 : 0)
    }
  }
}

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const mode = useGameStore((s) => s.gameMode)

  useEffect(() => {
    if (!containerRef.current) return

    // Expose current mode globally so the scene can read it on create
    ;(window as unknown as Record<string, unknown>).__rpgGameMode = mode

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      backgroundColor: '#1a1a1a',
      parent: containerRef.current,
      scene: [DungeonScene],
    }

    gameRef.current = new Phaser.Game(config)

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  // Update overlay when mode changes after mount
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__rpgGameMode = mode
    const game = gameRef.current
    if (!game) return
    const scene = game.scene.getScene('DungeonScene') as DungeonScene | null
    if (scene) {
      scene.setDialogueMode(mode === 'dialogue')
    }
  }, [mode])

  return <div ref={containerRef} />
}
