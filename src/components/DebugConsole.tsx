import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { dialogueNodes } from '../data/dialogueData'

const COMMANDS = ['goto']
const ALL_NODE_IDS = Object.keys(dialogueNodes)

interface Suggestion {
  label: string       // what to show
  complete: string    // the full input value if accepted
  hint?: string       // right-aligned hint (e.g. node's first words)
  execute?: boolean   // if accepting this should run the command
}

function nodeHint(id: string): string {
  const n = dialogueNodes[id]
  const words = n.narrative.split(/\s+/).slice(0, 6).join(' ')
  return words + '…'
}

// Build the list of suggestions for the current input, filtered to nodeIds.
function suggest(value: string, nodeIds: string[]): Suggestion[] {
  const parts = value.split(/\s+/)
  if (parts.length <= 1) {
    const prefix = parts[0] ?? ''
    return COMMANDS.filter((c) => c.startsWith(prefix)).map((c) => ({
      label: c,
      complete: c + ' ',
    }))
  }
  const [cmd, ...rest] = parts
  if (cmd === 'goto') {
    const prefix = rest.join(' ')
    return nodeIds.filter((id) => id.startsWith(prefix)).map((id) => ({
      label: id,
      complete: 'goto ' + id,
      hint: nodeHint(id),
      execute: true,
    }))
  }
  return []
}

export function DebugConsole() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const gotoNode = useGameStore((s) => s.gotoNode)
  const activeScenario = useGameStore((s) => s.activeScenario)

  // Only show nodes for the active scenario (prefix match: 'goblin' → 'goblin_*')
  const NODE_IDS = useMemo(
    () =>
      activeScenario
        ? ALL_NODE_IDS.filter((id) => id.startsWith(activeScenario + '_'))
        : [],
    [activeScenario],
  )

  const suggestions = open ? suggest(value, NODE_IDS) : []

  // Keep the selection index in range as suggestions change.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, suggestions.length - 1)))
  }, [value, suggestions.length])

  // Global "/" to open the console.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open) return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return
      if (e.key === '/') {
        e.preventDefault()
        setOpen(true)
        setValue('')
        setSelected(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function close() {
    setOpen(false)
    setValue('')
    setSelected(0)
  }

  function run(value: string) {
    const parts = value.trim().split(/\s+/)
    if (parts[0] === 'goto' && parts[1] && dialogueNodes[parts[1]]) {
      gotoNode(parts[1])
      close()
    }
  }

  function accept(s: Suggestion | undefined) {
    if (!s) return
    if (s.execute) {
      run(s.complete)
    } else {
      setValue(s.complete)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const s = suggestions[selected]
      if (s) setValue(s.complete)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const s = suggestions[selected]
      // Prefer the highlighted suggestion; else try to run raw input.
      if (s) accept(s)
      else run(value)
    }
  }

  if (!open) return null

  return (
    <div style={styles.overlay} onMouseDown={close}>
      <div style={styles.console} onMouseDown={(e) => e.stopPropagation()}>
        <div style={styles.inputRow}>
          <span style={styles.prompt}>/</span>
          <input
            ref={inputRef}
            style={styles.input}
            value={value}
            placeholder="goto <node>"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        {suggestions.length > 0 && (
          <div style={styles.list}>
            {suggestions.map((s, i) => (
              <div
                key={s.label}
                style={{
                  ...styles.item,
                  backgroundColor: i === selected ? '#1d1d10' : 'transparent',
                  borderLeft: i === selected ? '2px solid #c8a96e' : '2px solid transparent',
                }}
                onMouseEnter={() => setSelected(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  accept(s)
                }}
              >
                <span style={styles.itemLabel}>{s.label}</span>
                {s.hint && <span style={styles.itemHint}>{s.hint}</span>}
              </div>
            ))}
          </div>
        )}
        <div style={styles.footer}>
          <span>↑↓ select</span>
          <span>Tab complete</span>
          <span>Enter run</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '14vh',
    zIndex: 60,
  },
  console: {
    width: '520px',
    backgroundColor: '#0b0b0b',
    border: '1px solid #4a3a1a',
    boxShadow: '0 12px 50px rgba(0,0,0,0.9)',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #221a0e',
  },
  prompt: {
    color: '#c8a96e',
    fontFamily: 'monospace',
    fontSize: '1rem',
    marginRight: '8px',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#e8d8b0',
    fontFamily: 'monospace',
    fontSize: '0.95rem',
    letterSpacing: '0.02em',
  },
  list: {
    maxHeight: '320px',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '14px',
    padding: '7px 16px',
    cursor: 'pointer',
  },
  itemLabel: {
    color: '#c8a96e',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  itemHint: {
    color: '#5a5040',
    fontFamily: "'Georgia', serif",
    fontSize: '0.75rem',
    fontStyle: 'italic',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  footer: {
    display: 'flex',
    gap: '18px',
    padding: '8px 16px',
    borderTop: '1px solid #221a0e',
    color: '#4a4030',
    fontFamily: 'monospace',
    fontSize: '0.68rem',
  },
}
