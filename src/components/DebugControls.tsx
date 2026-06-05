import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { CheckOutcome } from '../store/gameStore'

const LABELS: Record<CheckOutcome, string> = {
  passed:          'PASS',
  passed_stressed: 'STRESS',
  failed:          'FAIL',
}

const COLORS: Record<CheckOutcome, string> = {
  passed:          '#4a9a4a',
  passed_stressed: '#b8922a',
  failed:          '#9a3a3a',
}

const OUTCOMES: CheckOutcome[] = ['passed', 'passed_stressed', 'failed']
const KEYS = ['p', 'f', 's']

export function DebugControls() {
  const force = useGameStore((s) => s.debugForceOutcome)
  const forcePassive = useGameStore((s) => s.debugForcePassiveOutcome)
  const setDebugForce = useGameStore((s) => s.setDebugForce)
  const setDebugForcePassive = useGameStore((s) => s.setDebugForcePassive)
  const currentNodeId = useGameStore((s) => s.currentNodeId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const k = e.key.toLowerCase()
      const idx = KEYS.indexOf(k)
      if (idx < 0) return
      const outcome = OUTCOMES[idx]
      if (e.shiftKey) {
        setDebugForcePassive(forcePassive === outcome ? null : outcome)
      } else {
        setDebugForce(force === outcome ? null : outcome)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [force, forcePassive, setDebugForce, setDebugForcePassive])

  return (
    <div style={styles.bar}>
      <span style={styles.nodeId}>{currentNodeId}</span>

      <span style={styles.groupLabel}>active</span>
      {OUTCOMES.map((outcome) => {
        const active = force === outcome
        return (
          <button
            key={outcome}
            style={{ ...styles.btn, borderColor: active ? COLORS[outcome] : '#2a2a1a', color: active ? COLORS[outcome] : '#3a3a2a' }}
            onClick={() => setDebugForce(active ? null : outcome)}
          >
            {LABELS[outcome]}
          </button>
        )
      })}

      <span style={{ ...styles.groupLabel, marginLeft: '8px' }}>passive</span>
      {OUTCOMES.map((outcome) => {
        const active = forcePassive === outcome
        return (
          <button
            key={outcome}
            style={{ ...styles.btn, borderColor: active ? COLORS[outcome] : '#2a2a1a', color: active ? COLORS[outcome] : '#3a3a2a' }}
            onClick={() => setDebugForcePassive(active ? null : outcome)}
          >
            {LABELS[outcome]}
          </button>
        )
      })}

      {(force || forcePassive) && (
        <span style={{ ...styles.indicator, color: '#5a5040' }}>
          {force && <span style={{ color: COLORS[force] }}>active → {force.replace('_', ' ')} </span>}
          {forcePassive && <span style={{ color: COLORS[forcePassive] }}>passive → {forcePassive.replace('_', ' ')}</span>}
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
  groupLabel: {
    fontFamily: 'monospace',
    fontSize: '0.62rem',
    letterSpacing: '0.06em',
    color: '#3a3a2a',
    textTransform: 'uppercase' as const,
  },
  indicator: {
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    letterSpacing: '0.04em',
    marginLeft: '8px',
  },
}
