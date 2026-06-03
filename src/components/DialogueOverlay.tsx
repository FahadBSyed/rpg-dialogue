import { useEffect, useRef, useState } from 'react'
import { useGameStore, LogEntry } from '../store/gameStore'
import { dialogueNodes } from '../data/dialogueData'
import { playScribble, playSkillChime, playCheckPass, playCheckFail, playCheckStress } from '../audio/soundManager'

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

const CHECK_COLORS = {
  passed:          '#4a9a4a',
  passed_stressed: '#b8922a',
  failed:          '#9a3a3a',
}

const CHECK_LABELS = {
  passed:          'PASSED',
  passed_stressed: 'PASSED',
  failed:          'FAILED',
}

function CheckEntry({ entry }: { entry: LogEntry }) {
  const [hovered, setHovered] = useState(false)
  const outcome = entry.checkOutcome!
  const rolls = entry.checkRolls!
  const displayOutcome = entry.passive && outcome === 'passed_stressed' ? 'passed' : outcome
  const color = CHECK_COLORS[displayOutcome]
  const tag = entry.passive ? '[PASSIVE]' : '[SKILL CHECK]'

  return (
    <div
      style={{ display: 'flex', alignItems: 'baseline', marginBottom: '16px', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ color: '#3a3030', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.08em', marginRight: '10px', flexShrink: 0 }}>
        {tag}
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.06em', color, cursor: 'default' }}>
        {entry.speaker} — {CHECK_LABELS[displayOutcome]}
        {entry.appliedBonus && (
          <span style={{ color: '#6a9eb0', fontSize: '0.72rem', marginLeft: '10px' }}>
            [{entry.appliedBonus.description}]
          </span>
        )}
      </span>
      {hovered && (
        <div style={{
          position: 'absolute',
          left: 0,
          bottom: '100%',
          marginBottom: '6px',
          backgroundColor: '#1a1a0e',
          border: `1px solid ${color}55`,
          padding: '8px 14px',
          zIndex: 20,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6a6040', marginRight: '8px' }}>
            {entry.checkDiceSize} ×{rolls.length}
          </span>
          {rolls.map((r, i) => {
            const isFail = r === 1
            const isOdd = r % 2 !== 0
            const dieColor = isFail ? '#9a3a3a' : isOdd ? '#b8922a' : '#4a9a4a'
            return (
              <span key={i} style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: dieColor, marginRight: i < rolls.length - 1 ? '8px' : 0 }}>
                {r}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SpeakerPortrait({ speaker }: { speaker: string }) {
  const color = speakerColor(speaker)
  const words = speaker.split(' ')

  return (
    <div style={{
      position: 'absolute',
      left: '-131px',
      top: '33.333%',
      transform: 'translateY(-50%)',
      width: '120px',
      height: '150px',
      backgroundColor: '#000',
      border: `1px solid ${color}33`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 12,
      boxShadow: `-4px 0 20px rgba(0,0,0,0.8)`,
    }}>
      <div style={{
        width: '90px',
        height: '90px',
        borderRadius: '50%',
        backgroundColor: `${color}22`,
        border: `1px solid ${color}88`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
      }}>
        <span style={{
          color: color,
          fontSize: words.length > 1 ? '0.55rem' : '0.62rem',
          fontFamily: 'monospace',
          textAlign: 'center',
          letterSpacing: '0.04em',
          lineHeight: 1.4,
          textTransform: 'uppercase',
        }}>
          {words.map((w, i) => <span key={i}>{w}{i < words.length - 1 ? <br /> : ''}</span>)}
        </span>
      </div>
    </div>
  )
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
  if (entry.type === 'check') return <CheckEntry entry={entry} />
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
  const characterCreated = useGameStore((s) => s.characterCreated)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const currentInterjectionIndex = useGameStore((s) => s.currentInterjectionIndex)
  const dialogueLog = useGameStore((s) => s.dialogueLog)
  const advanceInterjection = useGameStore((s) => s.advanceInterjection)
  const chooseOption = useGameStore((s) => s.chooseOption)
  const triggerPassiveCheck = useGameStore((s) => s.triggerPassiveCheck)

  const pendingPassiveResult = useGameStore((s) => s.pendingPassiveResult)
  const injectedInterjections = useGameStore((s) => s.injectedInterjections)

  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentNode = dialogueNodes[currentNodeId]
  const effectiveInterjections = [...injectedInterjections, ...currentNode.interjections]
  const visibleInterjections = effectiveInterjections.slice(0, currentInterjectionIndex)
  const allInterjectionsSeen = currentInterjectionIndex >= effectiveInterjections.length
  const nextInterjection = effectiveInterjections[currentInterjectionIndex]
  const activeSpeaker = visibleInterjections.length > 0
    ? visibleInterjections[visibleInterjections.length - 1].speaker
    : null

  // Auto-scroll
  useEffect(() => {
    if (!isUserScrolling.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [dialogueLog, currentInterjectionIndex])

  // Passive check + scribble when node changes
  const prevNodeId = useRef<string | null>(null)
  useEffect(() => {
    if (prevNodeId.current !== null && prevNodeId.current !== currentNodeId) {
      playScribble()
    }
    prevNodeId.current = currentNodeId

    if (currentNode.passiveCheck) {
      const { skillKey, successInterjection, successBonus } = currentNode.passiveCheck
      triggerPassiveCheck(skillKey, currentNodeId, successInterjection, successBonus)
    }
  }, [currentNodeId])

  // Sound: skill chime when a new interjection is revealed
  const prevInterjectionIndex = useRef(0)
  useEffect(() => {
    if (currentInterjectionIndex > prevInterjectionIndex.current && visibleInterjections.length > 0) {
      const speaker = visibleInterjections[visibleInterjections.length - 1].speaker
      playSkillChime(speaker)
    }
    prevInterjectionIndex.current = currentInterjectionIndex
  }, [currentInterjectionIndex, visibleInterjections])

  // Sound: check outcomes
  const prevLogLength = useRef(0)
  useEffect(() => {
    if (dialogueLog.length > prevLogLength.current) {
      const newEntries = dialogueLog.slice(prevLogLength.current)
      const checkEntry = newEntries.find((e) => e.type === 'check')
      if (checkEntry) {
        if (checkEntry.checkOutcome === 'failed') playCheckFail()
        else if (checkEntry.checkOutcome === 'passed_stressed' && !checkEntry.passive) playCheckStress()
        else if (checkEntry.checkOutcome === 'passed' || (checkEntry.checkOutcome === 'passed_stressed' && checkEntry.passive)) playCheckPass()
      }
    }
    prevLogLength.current = dialogueLog.length
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

  if (!characterCreated || mode !== 'dialogue') return null

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {activeSpeaker && <SpeakerPortrait speaker={activeSpeaker} />}

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

          {/* Passive check result — appears after narrator text */}
          {pendingPassiveResult && <LogLine entry={pendingPassiveResult} muted={false} />}

          {/* Interjections revealed so far this node */}
          {visibleInterjections.map((inj, i) => (
            <LogLine
              key={i}
              entry={{ type: 'interjection', speaker: inj.speaker, text: inj.text }}
              muted={false}
            />
          ))}
        </div>

        {/* Choices / continue pinned at bottom */}
        <div style={styles.choicesArea}>
          <div style={styles.fadeEdge} />
          <div style={styles.choices}>
            {!allInterjectionsSeen ? (
              /* Still have interjections to reveal — show speaker hint + ... */
              <button
                style={styles.continueButton}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = speakerColor(nextInterjection.speaker)
                  ;(e.currentTarget as HTMLButtonElement).style.color = speakerColor(nextInterjection.speaker)
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3020'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#5a5040'
                }}
                onClick={advanceInterjection}
              >
                <span style={{ color: speakerColor(nextInterjection.speaker), fontFamily: 'monospace', fontSize: '0.75rem', marginRight: '10px' }}>
                  [{nextInterjection.speaker}]
                </span>
                …
              </button>
            ) : (
              /* All interjections seen — show story choices */
              currentNode.choices.map((choice, i) => (
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
              ))
            )}
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
    position: 'relative',
    width: '480px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0d0d0d',
    border: '1px solid #3a3020',
    boxShadow: '0 0 40px rgba(0,0,0,0.9)',
  },
  scrollArea: {
    height: '66.666%',
    overflowY: 'scroll',
    padding: '32px 32px 16px',
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3020 #0d0d0d',
    flexShrink: 0,
  },
  divider: {
    borderTop: '1px solid #2a2010',
    margin: '12px 0 20px',
  },
  choicesArea: {
    height: '33.333%',
    borderTop: '1px solid #2a2010',
    padding: '20px 32px 0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    flexShrink: 0,
    overflow: 'hidden',
  },
  fadeEdge: {
    display: 'none',
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  continueButton: {
    background: 'transparent',
    border: '1px solid #3a3020',
    color: '#5a5040',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '1rem',
    padding: '10px 16px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    letterSpacing: '0.08em',
    borderRadius: 0,
    transition: 'border-color 0.15s, color 0.15s',
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
