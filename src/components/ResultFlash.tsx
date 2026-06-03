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
  // Fired by the dice roller at the synchronized reveal instant, so the flash
  // lands together with the number pop and the outcome sound.
  const signal = useGameStore((s) => s.resultFlash)
  const [flash, setFlash] = useState<{ color: string; id: number } | null>(null)
  const lastId = useRef(0)

  useEffect(() => {
    if (signal && signal.id !== lastId.current) {
      lastId.current = signal.id
      setFlash({ color: FLASH_COLORS[signal.outcome], id: signal.id })
    }
  }, [signal])

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
