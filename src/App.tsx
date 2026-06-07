import { PhaserGame } from './game/PhaserGame'
import { DialogueOverlay } from './components/DialogueOverlay'
import { RoomNav } from './components/RoomNav'
import { SkillPanel } from './components/SkillPanel'
import { CharacterCreation } from './components/CharacterCreation'
import { DebugControls } from './components/DebugControls'
import { DebugConsole } from './components/DebugConsole'
import { DiceRoller } from './components/DiceRoller'
import { ResultFlash } from './components/ResultFlash'
import { ScreenShake } from './components/ScreenShake'
import { useGameStore } from './store/gameStore'

function App() {
  const mode = useGameStore((s) => s.gameMode)
  const inDialogue = mode === 'dialogue'

  return (
    <div style={styles.root}>
      <CharacterCreation />
      <div style={styles.sidebar}>
        <SkillPanel />
      </div>
      <div style={styles.gameArea}>
        <PhaserGame />
        <RoomNav />
        <DialogueOverlay />
      </div>
      <DiceRoller />
      <ResultFlash />
      <ScreenShake />
      {inDialogue && <DebugControls />}
      {inDialogue && <DebugConsole />}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#111111',
    overflow: 'hidden',
  },
  gameArea: {
    flex: '0 0 75%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sidebar: {
    flex: '0 0 25%',
    height: '100%',
    overflow: 'hidden',
  },
}

export default App
