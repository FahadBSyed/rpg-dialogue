import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { CheckOutcome } from '../store/gameStore'

const LABELS: Record<CheckOutcome, string> = {
  passed:          'P — PASS',
  passed_stressed: 'S — STRESS',
  failed:          'F — FAIL',
}

const COLORS: Record<CheckOutcome, string> = {
  passed:          '#4a9a4a',
  passed_stressed: '#b8922a',
  failed:          '#9a3a3a',
}

export function DebugControls() {
  const force = useGameStore((s) => s.debugForceOutcome)
  const setDebugForce = useGameStore((s) => s.setDebugForce)
  const currentNodeId = useGameStore((s) => s.currentNodeId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'p' || e.key === 'P') setDebugForce(force === 'passed' ? null : 'passed')
      if (e.key === 'f' || e.key === 'F') setDebugForce(force === 'failed' ? null : 'failed')
      if (e.key === 's' || e.key === 'S') setDebugForce(force === 'passed_stressed' ? null : 'passed_stressed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [force, setDebugForce])

  return (
    <div style={styles.bar}>
      <span style={styles.nodeId}>{currentNodeId}</span>
      {(['passed', 'passed_stressed', 'failed'] as CheckOutcome[]).map((outcome) => {
        const active = force === outcome
        return (
          <button
            key={outcome}
            style={{
              ...styles.btn,
              borderColor: active ? COLORS[outcome] : '#2a2a1a',
              color: active ? COLORS[outcome] : '#3a3a2a',
            }}
            onClick={() => setDebugForce(active ? null : outcome)}
          >
            {LABELS[outcome]}
          </button>
        )
      })}
      {force && (
        <span style={{ ...styles.indicator, color: COLORS[force] }}>
          next check forced → {force.replace('_', ' ')}
        </span>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: '12px',
    left: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 50,
  },
  btn: {
    background: 'transparent',
    border: '1px solid',
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    letterSpacing: '0.06em',
    padding: '4px 10px',
    cursor: 'pointer',
    borderRadius: 0,
    transition: 'border-color 0.1s, color 0.1s',
  },
  nodeId: {
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    letterSpacing: '0.04em',
    color: '#4a4a3a',
    marginRight: '4px',
  },
  indicator: {
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    letterSpacing: '0.04em',
    marginLeft: '8px',
  },
}
