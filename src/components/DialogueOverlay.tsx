import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { dialogueNodes } from '../data/dialogueData'

export function DialogueOverlay() {
  const mode = useGameStore((s) => s.gameMode)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const dialogueLog = useGameStore((s) => s.dialogueLog)
  const chooseOption = useGameStore((s) => s.chooseOption)

  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentNode = dialogueNodes[currentNodeId]

  // Auto-scroll to bottom when log grows, unless user is reading history
  useEffect(() => {
    if (!isUserScrolling.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [dialogueLog])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (!atBottom) {
      isUserScrolling.current = true
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
      scrollTimeout.current = setTimeout(() => {
        isUserScrolling.current = false
      }, 2000)
    } else {
      isUserScrolling.current = false
    }
  }

  if (mode !== 'dialogue') return null

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>

        {/* Scrollable history + current narrative */}
        <div style={styles.scrollArea} ref={scrollRef} onScroll={handleScroll}>
          {/* Past log entries */}
          {dialogueLog.map((entry, i) => (
            <p
              key={i}
              style={entry.type === 'narrative' ? styles.logNarrative : styles.logChoice}
            >
              {entry.type === 'choice' && <span style={styles.choiceArrow}>› </span>}
              {entry.text}
            </p>
          ))}

          {/* Divider between history and current node */}
          {dialogueLog.length > 0 && <div style={styles.divider} />}

          {/* Current narrative — always visible at bottom of scroll area */}
          <p style={styles.currentNarrative}>{currentNode.narrative}</p>
        </div>

        {/* Choices pinned at the bottom */}
        <div style={styles.choicesArea}>
          <div style={styles.fadeEdge} />
          <div style={styles.choices}>
            {currentNode.choices.map((choice, i) => (
              <button
                key={i}
                style={styles.choiceButton}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#a88a50'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#c8a96e'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#5a4a2a'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#a88a50'
                }}
                onClick={() => chooseOption(i)}
              >
                {choice.text}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  panel: {
    maxWidth: '700px',
    width: '100%',
    height: '80vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0d0d0d',
    border: '1px solid #3a3020',
    boxShadow: '0 0 40px rgba(0,0,0,0.9)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'scroll',
    padding: '36px 48px 16px',
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3020 #0d0d0d',
  },
  logNarrative: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '0.95rem',
    lineHeight: '1.7',
    color: '#5a4a30',
    margin: '0 0 16px 0',
    letterSpacing: '0.01em',
  },
  logChoice: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '0.88rem',
    lineHeight: '1.5',
    color: '#4a3a22',
    margin: '0 0 20px 0',
    fontStyle: 'italic',
    letterSpacing: '0.02em',
  },
  choiceArrow: {
    fontStyle: 'normal',
    color: '#3a2e18',
  },
  divider: {
    borderTop: '1px solid #2a2010',
    margin: '8px 0 24px',
  },
  currentNarrative: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '1.05rem',
    lineHeight: '1.75',
    color: '#c8a96e',
    margin: '0 0 8px 0',
    letterSpacing: '0.01em',
  },
  choicesArea: {
    position: 'relative',
    padding: '0 48px 32px',
    flexShrink: 0,
  },
  fadeEdge: {
    height: '32px',
    background: 'linear-gradient(to bottom, transparent, #0d0d0d)',
    marginBottom: '12px',
    pointerEvents: 'none',
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
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
    borderRadius: 0,
    transition: 'border-color 0.15s, color 0.15s',
  },
}
