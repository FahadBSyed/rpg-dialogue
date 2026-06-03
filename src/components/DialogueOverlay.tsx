import { useGameStore } from '../store/gameStore'

const NARRATIVE =
  'The dungeon swallows sound. Somewhere below, water moves through limestone in the dark. You have been here before — or somewhere enough like here that the difference stopped mattering. Your torch is low. Two tunnels branch ahead.'

export function DialogueOverlay() {
  const mode = useGameStore((s) => s.gameMode)

  if (mode !== 'dialogue') return null

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <p style={styles.narrative}>{NARRATIVE}</p>
        <div style={styles.choices}>
          <button style={styles.choiceButton} onClick={() => window.close()}>
            Take the left tunnel.
          </button>
          <button style={styles.choiceButton} onClick={() => window.close()}>
            Turn back. There is nothing down here worth dying for.
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  panel: {
    maxWidth: '700px',
    width: '100%',
    padding: '40px 48px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #3a3020',
    boxShadow: '0 0 40px rgba(0,0,0,0.9)',
  },
  narrative: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '1.05rem',
    lineHeight: '1.75',
    color: '#c8a96e',
    margin: '0 0 32px 0',
    letterSpacing: '0.01em',
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  choiceButton: {
    background: 'transparent',
    border: '1px solid #5a4a2a',
    color: '#a88a50',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '0.95rem',
    padding: '12px 18px',
    cursor: 'pointer',
    textAlign: 'left',
    letterSpacing: '0.02em',
    transition: 'border-color 0.15s, color 0.15s',
    borderRadius: 0,
  },
}
