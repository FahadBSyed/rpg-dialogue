import { useGameStore, ROOM_ADJACENCY, type Room } from '../store/gameStore'

const ROOM_LABELS: Record<Room, string> = {
  deep: 'Deep Chamber',
  center: 'Center Hall',
  north: 'Goblin Den',
  east: 'East Room',
}

export function RoomNav() {
  const mode = useGameStore((s) => s.gameMode)
  const currentRoom = useGameStore((s) => s.currentRoom)
  const navigateTo = useGameStore((s) => s.navigateTo)

  if (mode !== 'exploration') return null

  const exits = ROOM_ADJACENCY[currentRoom]

  return (
    <div style={styles.nav}>
      <div style={styles.here}>{ROOM_LABELS[currentRoom]}</div>
      {exits.map((room) => (
        <button key={room} style={styles.button} onClick={() => navigateTo(room)}>
          → {ROOM_LABELS[room]}
        </button>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontFamily: 'monospace',
    fontSize: 13,
    zIndex: 10,
  },
  here: {
    color: '#9a8b6e',
    opacity: 0.7,
    marginBottom: 2,
  },
  button: {
    background: 'rgba(20, 18, 16, 0.75)',
    color: '#d8c9a8',
    border: '1px solid #4a3a28',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    textAlign: 'left',
  },
}
