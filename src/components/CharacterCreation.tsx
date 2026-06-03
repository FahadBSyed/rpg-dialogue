import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { SkillKey } from '../store/gameStore'

const ALL_SKILLS: { key: SkillKey; label: string }[] = [
  { key: 'endurance',   label: 'Endurance' },
  { key: 'scarring',    label: 'Scarring' },
  { key: 'hunger',      label: 'Hunger' },
  { key: 'dungeonLore', label: 'Dungeon Lore' },
  { key: 'appraisal',   label: 'Appraisal' },
  { key: 'wayfinding',  label: 'Wayfinding' },
  { key: 'scavenging',  label: 'Scavenging' },
  { key: 'reputation',  label: 'Reputation' },
  { key: 'deception',   label: 'Deception' },
  { key: 'spite',       label: 'Spite' },
  { key: 'dangerSense', label: 'Danger Sense' },
  { key: 'superstition',label: 'Superstition' },
  { key: 'theDeep',     label: 'The Deep' },
]

type Slot = 'd6_0' | 'd6_1' | 'd8_0' | 'd8_1' | 'd10_0'

const SLOTS: { id: Slot; label: string; die: string }[] = [
  { id: 'd6_0',  label: 'First skill',  die: 'd6' },
  { id: 'd6_1',  label: 'Second skill', die: 'd6' },
  { id: 'd8_0',  label: 'First skill',  die: 'd8' },
  { id: 'd8_1',  label: 'Second skill', die: 'd8' },
  { id: 'd10_0', label: 'Skill',        die: 'd10' },
]

const DIE_COLORS: Record<string, string> = {
  d6:  '#6a9eb0',
  d8:  '#9a7ab0',
  d10: '#c8a96e',
}

export function CharacterCreation() {
  const characterCreated = useGameStore((s) => s.characterCreated)
  const finalizeCharacter = useGameStore((s) => s.finalizeCharacter)

  const [selections, setSelections] = useState<Partial<Record<Slot, SkillKey>>>({})

  if (characterCreated) return null

  const chosen = new Set(Object.values(selections).filter(Boolean))

  function select(slot: Slot, value: string) {
    setSelections((prev) => ({ ...prev, [slot]: value as SkillKey }))
  }

  const allFilled =
    selections.d6_0 && selections.d6_1 &&
    selections.d8_0 && selections.d8_1 &&
    selections.d10_0

  function confirm() {
    if (!allFilled) return
    finalizeCharacter({
      d6:  [selections.d6_0!, selections.d6_1!],
      d8:  [selections.d8_0!, selections.d8_1!],
      d10: selections.d10_0!,
    })
  }

  const groups = [
    { die: 'd6',  slots: ['d6_0', 'd6_1'] as Slot[] },
    { die: 'd8',  slots: ['d8_0', 'd8_1'] as Slot[] },
    { die: 'd10', slots: ['d10_0'] as Slot[] },
  ]

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <h2 style={styles.title}>Distribute Your Abilities</h2>
        <p style={styles.subtitle}>
          All skills begin at <span style={styles.dim}>1d4</span>. Assign your strongest to larger dice.
        </p>

        <div style={styles.groups}>
          {groups.map(({ die, slots }) => (
            <div key={die} style={styles.group}>
              <div style={{ ...styles.dieLabel, color: DIE_COLORS[die] }}>{die}</div>
              {slots.map((slot) => {
                const slotInfo = SLOTS.find((s) => s.id === slot)!
                return (
                  <div key={slot} style={styles.row}>
                    <span style={styles.rowLabel}>{slotInfo.label}</span>
                    <select
                      style={styles.select}
                      value={selections[slot] ?? ''}
                      onChange={(e) => select(slot, e.target.value)}
                    >
                      <option value="" disabled>— choose —</option>
                      {ALL_SKILLS.map(({ key, label }) => (
                        <option
                          key={key}
                          value={key}
                          disabled={chosen.has(key) && selections[slot] !== key}
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <button
          style={{ ...styles.confirmButton, ...(allFilled ? styles.confirmActive : {}) }}
          disabled={!allFilled}
          onClick={confirm}
        >
          Begin
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.88)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  panel: {
    width: '460px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #3a3020',
    boxShadow: '0 0 60px rgba(0,0,0,0.95)',
    padding: '40px 48px',
  },
  title: {
    fontFamily: "'Georgia', serif",
    fontSize: '1rem',
    letterSpacing: '0.15em',
    color: '#c8a96e',
    margin: '0 0 10px 0',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: "'Georgia', serif",
    fontSize: '0.85rem',
    color: '#5a4a30',
    margin: '0 0 32px 0',
    lineHeight: 1.6,
  },
  dim: {
    color: '#8a7040',
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    marginBottom: '36px',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  dieLabel: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    letterSpacing: '0.12em',
    marginBottom: '4px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  rowLabel: {
    fontFamily: "'Georgia', serif",
    fontSize: '0.8rem',
    color: '#5a4a30',
    width: '90px',
    flexShrink: 0,
  },
  select: {
    flex: 1,
    backgroundColor: '#111',
    border: '1px solid #3a3020',
    color: '#c8a96e',
    fontFamily: "'Georgia', serif",
    fontSize: '0.85rem',
    padding: '7px 10px',
    outline: 'none',
    cursor: 'pointer',
    borderRadius: 0,
  },
  confirmButton: {
    width: '100%',
    padding: '13px',
    backgroundColor: 'transparent',
    border: '1px solid #3a3020',
    color: '#4a4030',
    fontFamily: "'Georgia', serif",
    fontSize: '0.9rem',
    letterSpacing: '0.1em',
    cursor: 'not-allowed',
    borderRadius: 0,
    transition: 'border-color 0.15s, color 0.15s',
  },
  confirmActive: {
    border: '1px solid #8a6a30',
    color: '#c8a96e',
    cursor: 'pointer',
  },
}
