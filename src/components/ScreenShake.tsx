import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { CheckOutcome } from '../store/gameStore'

// Peak shake amplitude (px) by outcome. Pass stays calm.
const AMPLITUDE: Record<CheckOutcome, number> = {
  passed:          0,
  passed_stressed: 6,
  failed:          15,
}

const DURATION = 300 // ms — lingers then settles

export function ScreenShake() {
  // Same reveal signal that drives the flash, so the shake hits on the
  // number reveal.
  const signal = useGameStore((s) => s.resultFlash)
  const lastId = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!signal || signal.id === lastId.current) return
    lastId.current = signal.id

    const amp = AMPLITUDE[signal.outcome]
    const el = document.getElementById('root')
    if (!el || amp <= 0) return

    const start = performance.now()
    cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const t = (now - start) / DURATION
      if (t >= 1) {
        el.style.transform = ''
        return
      }
      const k = (1 - t) * amp // linear decay
      const x = (Math.random() * 2 - 1) * k
      const y = (Math.random() * 2 - 1) * k
      el.style.transform = `translate(${x}px, ${y}px)`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      el.style.transform = ''
    }
  }, [signal])

  return null
}
