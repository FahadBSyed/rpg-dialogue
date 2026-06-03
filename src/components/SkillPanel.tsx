import { useGameStore } from '../store/gameStore'
import type { Skills } from '../store/gameStore'

type AttributeGroup = {
  label: string
  keys: (keyof Skills)[]
}

const ATTRIBUTES: AttributeGroup[] = [
  { label: 'FLESH', keys: ['endurance', 'scarring', 'hunger'] },
  { label: 'WIT', keys: ['dungeonLore', 'appraisal', 'wayfinding', 'scavenging'] },
  { label: 'STATION', keys: ['reputation', 'deception', 'spite'] },
  { label: 'INSTINCT', keys: ['dangerSense', 'superstition', 'theDeep'] },
]

export function SkillPanel() {
  const skills = useGameStore((s) => s.skills)

  return (
    <aside style={styles.panel}>
      <h2 style={styles.header}>FIODOR</h2>
      {ATTRIBUTES.map((attr) => (
        <div key={attr.label} style={styles.group}>
          <div style={styles.attributeLabel}>{attr.label}</div>
          {attr.keys.map((key) => {
            const skill = skills[key]
            return (
              <div key={key} style={styles.skillRow}>
                <span style={styles.skillName}>{skill.name}</span>
                <span style={styles.skillLevel}>{skill.pool}{skill.size}</span>
              </div>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0d0d0d',
    borderLeft: '1px solid #2a2010',
    padding: '16px 12px',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  header: {
    fontFamily: "'Georgia', serif",
    fontSize: '0.75rem',
    letterSpacing: '0.15em',
    color: '#6a5830',
    margin: '0 0 16px 0',
    textAlign: 'center',
    borderBottom: '1px solid #2a2010',
    paddingBottom: '10px',
  },
  group: {
    marginBottom: '16px',
  },
  attributeLabel: {
    fontFamily: "'Georgia', serif",
    fontSize: '0.6rem',
    letterSpacing: '0.2em',
    color: '#5a4820',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
  },
  skillRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '3px 4px',
    borderBottom: '1px solid #1a1a10',
  },
  skillName: {
    fontFamily: "'Georgia', serif",
    fontSize: '0.75rem',
    color: '#8a7040',
  },
  skillLevel: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: '#c8a96e',
    minWidth: '16px',
    textAlign: 'right' as const,
  },
}
