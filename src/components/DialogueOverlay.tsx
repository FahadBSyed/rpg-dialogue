import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore, LogEntry, ActiveBonus, ActivePenalty, Skill } from '../store/gameStore'
import { dialogueNodes } from '../data/dialogueData'
import { playScribble, playScribbleSoft, playSkillChime, playCheckPass, playGoblinMutter } from '../audio/soundManager'

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
  // External voices — the goblins. A sickly-green family, distinct from the
  // internal skill palette: deep moss (Grit), acid (Nim), dull olive (Bole).
  GRIT:         '#6e8257',
  NIM:          '#9fb046',
  BOLE:         '#8a924f',
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

// Split prose into word + whitespace tokens, preserving the whitespace so the
// text reflows exactly as normal — we render every token and then measure where
// the browser actually wrapped it, to animate one *visual* line at a time.
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0)
}

const WS = /^\s+$/

function AnimatedText({ text, instant, onDone, onLineReveal }: {
  text: string
  instant: boolean
  onDone?: () => void
  onLineReveal?: () => void
}) {
  const tokens = useMemo(() => tokenize(text), [text])
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  // Visual line index per token, computed after layout. Null until measured.
  const [tokenLine, setTokenLine] = useState<number[] | null>(null)
  const [totalLines, setTotalLines] = useState(0)
  const [count, setCount] = useState(0)
  // Line count at which a skip happened — lines beyond it appear without fade.
  const snapAt = useRef<number | null>(instant ? 0 : null)
  const doneCalled = useRef(false)

  function done() {
    if (!doneCalled.current) { doneCalled.current = true; onDone?.() }
  }

  // After layout, group tokens into visual lines by their vertical position.
  useLayoutEffect(() => {
    const map: number[] = []
    let line = -1
    let lastTop: number | null = null
    for (let i = 0; i < tokens.length; i++) {
      if (WS.test(tokens[i])) {
        // Whitespace rides with the line it follows (it's invisible anyway).
        map[i] = line < 0 ? 0 : line
        continue
      }
      const el = wordRefs.current[i]
      if (!el) { map[i] = line < 0 ? 0 : line; continue }
      const top = el.offsetTop
      if (lastTop === null || top > lastTop + 1) { line++; lastTop = top }
      map[i] = line
    }
    setTokenLine(map)
    setTotalLines(line + 1)
    if (instant) setCount(line + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  // Snap to fully revealed when instant becomes true mid-animation
  useEffect(() => {
    if (instant && snapAt.current === null) {
      snapAt.current = count
      setCount(totalLines)
      done()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant])

  // Reveal one visual line at a time, once measured
  useEffect(() => {
    if (instant || tokenLine === null) return
    if (count >= totalLines) { done(); return }
    const delay = count === 0 ? 0 : 280
    const t = setTimeout(() => {
      onLineReveal?.()
      setCount((c) => c + 1)
    }, delay)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, instant, totalLines, tokenLine])

  return (
    <>
      {tokens.map((tok, i) => {
        const line = tokenLine ? tokenLine[i] : null
        const revealed = line !== null && line < count
        const animated = revealed && (snapAt.current === null || line! < snapAt.current)
        return (
          <span
            key={i}
            ref={(el) => { wordRefs.current[i] = el }}
            style={{
              opacity: revealed ? 1 : 0,
              animation: animated ? 'sentence-fade-in 0.18s ease-in forwards' : 'none',
            }}
          >
            {tok}
          </span>
        )
      })}
    </>
  )
}

const DICE_STEPS = ['d4', 'd6', 'd8', 'd10', 'd12'] as const

const BONUS_TYPE_LABELS: Record<string, string> = {
  size_step_up: 'Die step up',
  ignore_stress: 'Ignore stress',
}

const PENALTY_TYPE_LABELS: Record<string, string> = {
  size_step_down: 'Die step down',
  add_stress_die: 'Stress die',
  lock_choice: 'Option locked',
}

function CheckAnnotation({ checkName, color, skill, bonuses, penalties }: {
  checkName: string
  color: string
  skill: Skill
  bonuses: ActiveBonus[]
  penalties: ActivePenalty[]
}) {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLSpanElement>(null)

  const sizeUps = bonuses.filter((b) => b.type === 'size_step_up').length
  const sizeDowns = penalties.filter((p) => p.type === 'size_step_down').length
  const stressDice = penalties.filter((p) => p.type === 'add_stress_die').length
  // Size steps that fall below the minimum die don't vanish — each becomes a
  // stress die added to the pool (mirrors the resolution in chooseOption).
  const net = sizeUps - sizeDowns
  const baseIdx = DICE_STEPS.indexOf(skill.size as typeof DICE_STEPS[number])
  const rawIdx = baseIdx + net
  const clampedIdx = Math.max(0, Math.min(DICE_STEPS.length - 1, rawIdx))
  const effectiveSize = DICE_STEPS[clampedIdx]
  const overflowDice = Math.max(0, -rawIdx)
  const effectivePool = skill.pool + stressDice + overflowDice
  const sizeChanged = effectiveSize !== skill.size
  const poolChanged = effectivePool !== skill.pool
  const hasModifiers = bonuses.length > 0 || penalties.length > 0

  function handleMouseEnter() {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setTooltipPos({ top: r.top + window.scrollY, left: r.left + window.scrollX })
    }
    setHovered(true)
  }

  const tooltip = hovered && createPortal(
    <div style={{
      position: 'absolute',
      top: tooltipPos.top - 8,
      left: tooltipPos.left,
      transform: 'translateY(-100%)',
      backgroundColor: '#111108',
      border: `1px solid ${color}44`,
      padding: '10px 14px',
      zIndex: 9999,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      minWidth: '180px',
    }}>
          {/* Effective dice — show base → effective when modifiers exist */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: hasModifiers ? '8px' : 0 }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#5a4a30' }}>POOL</span>
            {(sizeChanged || poolChanged) ? (
              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                <span style={{ color: '#5a4a30', textDecoration: 'line-through', marginRight: '5px' }}>
                  {skill.size} × {skill.pool}
                </span>
                <span style={{ color }}>
                  {effectiveSize} × {effectivePool}
                </span>
              </span>
            ) : (
              <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color }}>
                {skill.size} × {skill.pool}
              </span>
            )}
          </div>
          {/* Bonuses */}
          {bonuses.map((b) => (
            <div key={b.id} style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#6a9eb0' }}>
                + {BONUS_TYPE_LABELS[b.type] ?? b.type}
              </span>
              <span style={{ fontFamily: "'Georgia', serif", fontSize: '0.7rem', color: '#4a5a6a', marginLeft: '10px' }}>
                {b.sourceDescription}
              </span>
            </div>
          ))}
          {/* Penalties */}
          {penalties.map((p) => (
            <div key={p.id} style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9a4a3a' }}>
                − {PENALTY_TYPE_LABELS[p.type] ?? p.type}
              </span>
              <span style={{ fontFamily: "'Georgia', serif", fontSize: '0.7rem', color: '#6a3a2a', marginLeft: '10px' }}>
                {p.sourceDescription}
              </span>
            </div>
          ))}
    </div>,
    document.body
  )

  return (
    <span
      ref={anchorRef}
      style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ color, fontFamily: 'monospace', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
        [{checkName} Check]
      </span>
      {tooltip}
    </span>
  )
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
        {entry.appliedPenalty && (
          <span style={{ color: '#9a4a3a', fontSize: '0.72rem', marginLeft: '10px' }}>
            [{entry.appliedPenalty.description}]
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

function LogLine({ entry, muted, instant = true, onDone }: {
  entry: LogEntry
  muted: boolean
  instant?: boolean
  onDone?: () => void
}) {
  if (entry.type === 'check') return <CheckEntry entry={entry} />

  // External speech — a goblin talking aloud. Distinct from the internal skill
  // voices: a guillemet tag, the goblin's green, and italic "spoken" prose.
  if (entry.external) {
    const tagColor = muted ? '#3f4632' : speakerColor(entry.speaker)
    const bodyColor = muted ? '#4c5238' : '#aeb887'
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={{ color: tagColor, fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.08em', marginRight: '10px', flexShrink: 0 }}>
          » {entry.speaker}
        </span>
        <span style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: '0.93rem',
          lineHeight: '1.65',
          color: bodyColor,
          fontStyle: 'italic',
          letterSpacing: '0.01em',
        }}>
          {'“'}<AnimatedText key={entry.text} text={entry.text} instant={instant} onDone={onDone} />{'”'}
        </span>
      </div>
    )
  }

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
        <AnimatedText
          key={entry.text}
          text={entry.text}
          instant={instant}
          onDone={onDone}
          onLineReveal={muted ? undefined : playScribbleSoft}
        />
      </span>
    </div>
  )
}

export function DialogueOverlay() {
  const mode = useGameStore((s) => s.gameMode)
  const characterCreated = useGameStore((s) => s.characterCreated)
  const skills = useGameStore((s) => s.skills)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const dialogueLog = useGameStore((s) => s.dialogueLog)
  const advanceBeat = useGameStore((s) => s.advanceBeat)
  const chooseOption = useGameStore((s) => s.chooseOption)

  const beatCursor = useGameStore((s) => s.beatCursor)
  const revealedBeats = useGameStore((s) => s.revealedBeats)
  const pendingBonuses = useGameStore((s) => s.pendingBonuses)
  const pendingPenalties = useGameStore((s) => s.pendingPenalties)

  // Track which node the narrator has finished animating for. Comparing against
  // currentNodeId gives us a value that is immediately correct on every render —
  // no effect lag that would cause the new narrator to mount with instant=true.
  const [narratorDoneForNode, setNarratorDoneForNode] = useState<string | null>(null)
  const narratorAnimating = narratorDoneForNode !== currentNodeId
  const [lastBeatDone, setLastBeatDone] = useState(true)
  const [instant, setInstant] = useState(false)
  // True while we're waiting for the post-check pause to elapse before starting
  // the narrator animation on the new node.
  const [postCheckDelay, setPostCheckDelay] = useState(false)

  // The last revealed beat is always the animating one — computed inline, not via effect,
  // so the new LogLine sees instant=false on its very first render.
  const lastBeatIdx = revealedBeats.length - 1
  const isAnimating = narratorAnimating || !lastBeatDone

  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrolling = useRef(false)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentNode = dialogueNodes[currentNodeId]
  const beats = currentNode.beats
  const allBeatsSeen = beatCursor >= beats.length
  const nextBeat = beats[beatCursor]
  // A passive beat isn't telegraphed by name — only voices show their speaker.
  const nextSpeaker = nextBeat
    ? (nextBeat.kind === 'voice' ? nextBeat.speaker : null)
    : null
  const nextExternal = !!(nextBeat && nextBeat.kind === 'voice' && nextBeat.external)
  // Portrait follows the most recently revealed voice line.
  const lastVoice = [...revealedBeats].reverse().find((e) => e.type === 'interjection')
  const activeSpeaker = lastVoice ? lastVoice.speaker : null

  // Restart narrator animation on each new node. After a check, hold the text
  // invisible briefly so it doesn't start mid-dice-animation.
  useEffect(() => {
    const lastEntry = dialogueLog[dialogueLog.length - 1]
    const cameFromCheck = lastEntry?.type === 'check'
    setLastBeatDone(true)
    setInstant(false)
    if (cameFromCheck) {
      setPostCheckDelay(true)
      const t = setTimeout(() => setPostCheckDelay(false), 350)
      return () => clearTimeout(t)
    } else {
      setPostCheckDelay(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId])

  // Mark the incoming beat as not done so isAnimating stays true until it finishes
  useEffect(() => {
    if (revealedBeats.length > 0) {
      setLastBeatDone(false)
      setInstant(false)
    }
  }, [revealedBeats.length])

  // Auto-scroll
  useEffect(() => {
    if (!isUserScrolling.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [dialogueLog, revealedBeats])

  // Scribble when the node changes
  const prevNodeId = useRef<string | null>(null)
  useEffect(() => {
    if (prevNodeId.current !== null && prevNodeId.current !== currentNodeId) {
      playScribble()
    }
    prevNodeId.current = currentNodeId
  }, [currentNodeId])

  // Sound as beats are revealed: a passed passive plays the pass tone; every
  // revealed voice line (including a passive's message) plays its skill chime.
  const prevRevealedLen = useRef(0)
  useEffect(() => {
    if (revealedBeats.length > prevRevealedLen.current) {
      const fresh = revealedBeats.slice(prevRevealedLen.current)
      fresh.forEach((e) => {
        if (e.type === 'check' && e.passive) playCheckPass()
        else if (e.type === 'interjection' && e.external) playGoblinMutter()
        else if (e.type === 'interjection') playSkillChime(e.speaker)
      })
    }
    prevRevealedLen.current = revealedBeats.length
  }, [revealedBeats])

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

          {/* Current narrator line — suppressed during the post-check pause so
              the AnimatedText mounts only after the dice have cleared */}
          {!postCheckDelay && (
            <LogLine
              entry={{ type: 'narrative', speaker: 'NARRATOR', text: currentNode.narrative }}
              muted={false}
              instant={!narratorAnimating || instant}
              onDone={() => { setNarratorDoneForNode(currentNodeId); setInstant(false) }}
            />
          )}

          {/* Beats revealed so far this node (voice lines + passed passives) */}
          {!postCheckDelay && revealedBeats.map((entry, i) => (
            <LogLine
              key={i}
              entry={entry}
              muted={false}
              instant={i < lastBeatIdx || (i === lastBeatIdx && instant)}
              onDone={i === lastBeatIdx
                ? () => { setLastBeatDone(true); setInstant(false) }
                : undefined}
            />
          ))}
        </div>

        {/* Choices / continue pinned at bottom */}
        <div style={styles.choicesArea}>
          <div style={styles.fadeEdge} />
          <div style={styles.choices}>
            {postCheckDelay ? null : !allBeatsSeen ? (
              /* More beats to reveal — show the next voice's speaker, or a
                 neutral prompt for an (untelegraphed) passive check */
              <button
                style={styles.continueButton}
                onMouseEnter={(e) => {
                  const c = nextSpeaker ? speakerColor(nextSpeaker) : '#8a7a4a'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = c
                  ;(e.currentTarget as HTMLButtonElement).style.color = c
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3020'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#5a5040'
                }}
                onClick={() => { if (isAnimating) { setInstant(true) } else { advanceBeat() } }}
              >
                {nextSpeaker && (
                  <span style={{ color: speakerColor(nextSpeaker), fontFamily: 'monospace', fontSize: '0.75rem', marginRight: '10px' }}>
                    {nextExternal ? `» ${nextSpeaker}` : `[${nextSpeaker}]`}
                  </span>
                )}
                …
              </button>
            ) : (
              /* All interjections seen — show story choices (unlock-gated ones
                 only when a matching unlock_choice bonus is pending) */
              currentNode.choices
                .map((choice, i) => ({ choice, i }))
                .filter(({ choice }) =>
                  (!choice.requiresUnlock ||
                    pendingBonuses.some(
                      (b) => b.type === 'unlock_choice' && b.unlockKey === choice.requiresUnlock
                    )) &&
                  (!choice.suppressedBy ||
                    !pendingBonuses.some(
                      (b) => b.type === 'unlock_choice' && b.unlockKey === choice.suppressedBy
                    )) &&
                  (!choice.lockedBy ||
                    !pendingPenalties.some(
                      (p) => p.type === 'lock_choice' && p.lockKey === choice.lockedBy
                    ))
                )
                .map(({ choice, i }) => (
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
                  onClick={() => { if (isAnimating) { setInstant(true) } else { chooseOption(i) } }}
                >
                  {choice.text}
                  {choice.check && (() => {
                    const sk = choice.check.skillKey
                    const skill = skills[sk]
                    const checkName = skill.name
                    const color = speakerColor(checkName.toUpperCase())
                    const applicableBonuses = pendingBonuses.filter(
                      (b) => (b.type === 'size_step_up' || b.type === 'ignore_stress') && b.skillKey === sk
                    )
                    const applicablePenalties = pendingPenalties.filter(
                      (p) => (p.type === 'size_step_down' || p.type === 'add_stress_die') && p.skillKey === sk
                    )
                    return (
                      <CheckAnnotation
                        checkName={checkName}
                        color={color}
                        skill={skill}
                        bonuses={applicableBonuses}
                        penalties={applicablePenalties}
                      />
                    )
                  })()}
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
    // No backdrop — the dungeon stays fully visible behind the dialogue panel.
    backgroundColor: 'transparent',
    // Let clicks on the uncovered dungeon area fall through; the panel itself
    // re-enables pointer events below.
    pointerEvents: 'none',
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
    pointerEvents: 'auto',
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
    padding: '20px 32px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    flexShrink: 0,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3020 #0d0d0d',
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
