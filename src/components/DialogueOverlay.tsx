import { useEffect, useRef } from 'react'
import { useGameStore, LogEntry } from '../store/gameStore'
import { dialogueNodes } from '../data/dialogueData'

// Colour the speaker tag by attribute / role
const SPEAKER_COLORS: Record<string, string> = {
  NARRATOR:     '#c8a96e',
  YOU:          '#7a9e7a',
  // FLESH
  ENDURANCE:    '#b06060',
  SCARRING:     '#b06060',
  HUNGER:       '#b06060',
  // WIT
  'DUNGEON LORE': '#6a9eb0',
  APPRAISAL:    '#6a9eb0',
  WAYFINDING:   '#6a9eb0',
  SCAVENGING:   '#6a9eb0',
  // STATION
  REPUTATION:   '#9a7ab0',
  DECEPTION:    '#9a7ab0',
  SPITE:        '#9a7ab0',
  // INSTINCT
  'DANGER SENSE': '#6ab0a0',
  SUPERSTITION: '#6ab0a0',
  'THE DEEP':   '#6ab0a0',
}

function speakerColor(speaker: string): string {
  return SPEAKER_COLORS[speaker] ?? '#8a8a8a'
}

function SpeakerTag({ speaker, muted }: { speaker: string; muted: boolean }) {
  const color = muted ? '#3a3030' : speakerColor(speaker)
  return (
    <span style={{ color, fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.08em', marginRight: '10px', flexShrink: 0 }}>
      [{speaker}]
    </span>
  )
}

function LogLine({ entry, muted }: { entry: LogEntry; muted: boolean }) {
  const isChoice = entry.type === 'choice'
  const textColor = muted
    ? (isChoice ? '#3a3028' : '#4a4038')
    : (isChoice ? '#7a9e7a' : '#9a8a6a')

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: isChoice ? '20px' : '10px' }}>
      <SpeakerTag speaker={entry.speaker} muted={muted} />
      <span style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        fontSize: isChoice ? '0.88rem' : '0.93rem',
        lineHeight: '1.65',
        color: textColor,
        fontStyle: isChoice ? 'italic' : 'normal',
        letterSpacing: '0.01em',
      }}>
        {entry.text}
      </span>
    </div>
  )
}

export function DialogueOverlay() {
  const mode = useGameStore((s) => s.gameMode)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const dialogueLog = useGameStore((s) => s.dialogueLog)
  const chooseOption = useGameStore((s) => s.chooseOption)

  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentNode = dialogueNodes[currentNodeId]

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
      scrollTimeout.current = setTimeout(() => { isUserScrolling.current = false }, 2000)
    } else {
      isUserScrolling.current = false
    }
  }

  if (mode !== 'dialogue') return null

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>

        <div style={styles.scrollArea} ref={scrollRef} onScroll={handleScroll}>

          {/* History */}
          {dialogueLog.map((entry, i) => (
            <LogLine key={i} entry={entry} muted={true} />
          ))}

          {/* Divider between history and current */}
          {dialogueLog.length > 0 && <div style={styles.divider} />}

          {/* Current narrator line */}
          <LogLine
            entry={{ type: 'narrative', speaker: 'NARRATOR', text: currentNode.narrative }}
            muted={false}
          />

          {/* Current skill interjections */}
          {currentNode.interjections.map((inj, i) => (
            <LogLine
              key={i}
              entry={{ type: 'interjection', speaker: inj.speaker, text: inj.text }}
              muted={false}
            />
          ))}
        </div>

        {/* Choices pinned at bottom */}
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
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  panel: {
    width: '480px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0d0d0d',
    border: '1px solid #3a3020',
    boxShadow: '0 0 40px rgba(0,0,0,0.9)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'scroll',
    padding: '32px 32px 16px',
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3020 #0d0d0d',
  },
  divider: {
    borderTop: '1px solid #2a2010',
    margin: '12px 0 20px',
  },
  choicesArea: {
    position: 'relative',
    padding: '0 32px 28px',
    flexShrink: 0,
  },
  fadeEdge: {
    height: '32px',
    background: 'linear-gradient(to bottom, transparent, #0d0d0d)',
    marginBottom: '10px',
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
    fontSize: '0.92rem',
    padding: '11px 16px',
    cursor: 'pointer',
    textAlign: 'left',
    letterSpacing: '0.02em',
    borderRadius: 0,
    transition: 'border-color 0.15s, color 0.15s',
  },
}
