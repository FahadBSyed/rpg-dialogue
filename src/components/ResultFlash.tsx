import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { CheckOutcome } from '../store/gameStore'

// Bottom-of-screen gradient flash colours, by what the result means.
const FLASH_COLORS: Record<CheckOutcome, string> = {
  passed:          '#3fae5a',
  passed_stressed: '#d6a93f',
  failed:          '#c25450',
}

export function ResultFlash() {
  const dialogueLog = useGameStore((s) => s.dialogueLog)
  const [flash, setFlash] = useState<{ color: string; id: number } | null>(null)
  const prevLen = useRef(0)
  const idRef = useRef(0)

  useEffect(() => {
    if (dialogueLog.length > prevLen.current) {
      const fresh = dialogueLog.slice(prevLen.current)
      // Flash for the active (player-triggered) check only — passive results
      // shouldn't paint the screen on every room entry.
      const active = [...fresh].reverse().find((e) => e.type === 'check' && !e.passive)
      if (active?.checkOutcome) {
        setFlash({ color: FLASH_COLORS[active.checkOutcome], id: ++idRef.current })
      }
    }
    prevLen.current = dialogueLog.length
  }, [dialogueLog])

  if (!flash) return null

  return (
    <div
      key={flash.id}
      className="result-flash"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
        pointerEvents: 'none',
        zIndex: 45,
        background: `linear-gradient(to top, ${flash.color} 0%, ${flash.color}88 35%, transparent 100%)`,
      }}
      onAnimationEnd={() => setFlash(null)}
    />
  )
}
