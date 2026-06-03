import { create } from 'zustand'
import { dialogueNodes } from '../data/dialogueData'

export type DiceSize = 'd4' | 'd6' | 'd8' | 'd10' | 'd12'

export interface Skill {
  name: string
  attribute: string
  size: DiceSize
  pool: number
  description: string
}

export interface Skills {
  // FLESH
  endurance: Skill
  scarring: Skill
  hunger: Skill
  // WIT
  dungeonLore: Skill
  appraisal: Skill
  wayfinding: Skill
  scavenging: Skill
  // STATION
  reputation: Skill
  deception: Skill
  spite: Skill
  // INSTINCT
  dangerSense: Skill
  superstition: Skill
  theDeep: Skill
}

export type GameMode = 'exploration' | 'dialogue'

export interface LogEntry {
  type: 'narrative' | 'choice' | 'interjection'
  speaker: string
  text: string
}

export type SkillKey = keyof Skills

export interface CharacterSelections {
  d6: [SkillKey, SkillKey]
  d8: [SkillKey, SkillKey]
  d10: SkillKey
}

interface GameState {
  gameMode: GameMode
  skills: Skills
  characterCreated: boolean
  currentNodeId: string
  currentInterjectionIndex: number
  dialogueLog: LogEntry[]
  finalizeCharacter: (selections: CharacterSelections) => void
  setMode: (mode: GameMode) => void
  advanceInterjection: () => void
  chooseOption: (choiceIndex: number) => void
}

export const useGameStore = create<GameState>()((set) => ({
  gameMode: 'dialogue',

  skills: {
    // FLESH
    endurance: {
      name: 'Endurance',
      attribute: 'FLESH',
      size: 'd4', pool: 2,
      description: "The body's refusal to quit — slow, stubborn, almost bovine.",
    },
    scarring: {
      name: 'Scarring',
      attribute: 'FLESH',
      size: 'd4', pool: 2,
      description: 'Every wound remembers the thing that made it.',
    },
    hunger: {
      name: 'Hunger',
      attribute: 'FLESH',
      size: 'd4', pool: 2,
      description:
        'Recognizes compulsion and appetite in all their forms — including your own.',
    },

    // WIT
    dungeonLore: {
      name: 'Dungeon Lore',
      attribute: 'WIT',
      size: 'd4', pool: 2,
      description: 'Catalogues monsters, traps, and architecture obsessively.',
    },
    appraisal: {
      name: 'Appraisal',
      attribute: 'WIT',
      size: 'd4', pool: 2,
      description: 'Everything has a price. Everything can be assessed.',
    },
    wayfinding: {
      name: 'Wayfinding',
      attribute: 'WIT',
      size: 'd4', pool: 2,
      description: 'Reads rooms and tunnels like text.',
    },
    scavenging: {
      name: 'Scavenging',
      attribute: 'WIT',
      size: 'd4', pool: 2,
      description: 'Sees potential where others see waste.',
    },

    // STATION
    reputation: {
      name: 'Reputation',
      attribute: 'STATION',
      size: 'd4', pool: 2,
      description: 'Knows exactly what people say about you, and why.',
    },
    deception: {
      name: 'Deception',
      attribute: 'STATION',
      size: 'd4', pool: 2,
      description:
        'The social weapons of the powerless — misdirection, playing small.',
    },
    spite: {
      name: 'Spite',
      attribute: 'STATION',
      size: 'd4', pool: 2,
      description:
        'The chip on the shoulder as a fuel source. Dangerous when left unattended.',
    },

    // INSTINCT
    dangerSense: {
      name: 'Danger Sense',
      attribute: 'INSTINCT',
      size: 'd4', pool: 2,
      description:
        "Wordless and urgent. Doesn't explain itself — just insists.",
    },
    superstition: {
      name: 'Superstition',
      attribute: 'INSTINCT',
      size: 'd4', pool: 2,
      description:
        'Knows the old delver rituals and folk wisdom. Irrational but right.',
    },
    theDeep: {
      name: 'The Deep',
      attribute: 'INSTINCT',
      size: 'd4', pool: 2,
      description: "Slow, vast, barely verbal. Knows things it shouldn't.",
    },
  },

  characterCreated: false,
  currentNodeId: 'start',
  currentInterjectionIndex: 0,
  dialogueLog: [],

  finalizeCharacter: (selections) =>
    set((state) => {
      const updatedSkills = { ...state.skills }
      const bump = (key: SkillKey, size: DiceSize) => {
        updatedSkills[key] = { ...updatedSkills[key], size }
      }
      selections.d6.forEach((k) => bump(k, 'd6'))
      selections.d8.forEach((k) => bump(k, 'd8'))
      bump(selections.d10, 'd10')
      return { skills: updatedSkills, characterCreated: true }
    }),

  setMode: (mode) => set({ gameMode: mode }),

  advanceInterjection: () =>
    set((state) => ({
      currentInterjectionIndex: state.currentInterjectionIndex + 1,
    })),

  chooseOption: (choiceIndex) =>
    set((state) => {
      const node = dialogueNodes[state.currentNodeId]
      const choice = node.choices[choiceIndex]
      return {
        currentNodeId: choice.nextNodeId,
        currentInterjectionIndex: 0,
        dialogueLog: [
          ...state.dialogueLog,
          { type: 'narrative', speaker: 'NARRATOR', text: node.narrative },
          ...node.interjections.map((i) => ({
            type: 'interjection' as const,
            speaker: i.speaker,
            text: i.text,
          })),
          { type: 'choice', speaker: 'YOU', text: choice.text },
        ],
      }
    }),
}))
