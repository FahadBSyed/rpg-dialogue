import { create } from 'zustand'

export interface Skill {
  name: string
  attribute: string
  level: number
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

interface GameState {
  gameMode: GameMode
  skills: Skills
  setMode: (mode: GameMode) => void
}

export const useGameStore = create<GameState>()((set) => ({
  gameMode: 'dialogue',

  skills: {
    // FLESH
    endurance: {
      name: 'Endurance',
      attribute: 'FLESH',
      level: 1,
      description: "The body's refusal to quit — slow, stubborn, almost bovine.",
    },
    scarring: {
      name: 'Scarring',
      attribute: 'FLESH',
      level: 1,
      description: 'Every wound remembers the thing that made it.',
    },
    hunger: {
      name: 'Hunger',
      attribute: 'FLESH',
      level: 1,
      description:
        'Recognizes compulsion and appetite in all their forms — including your own.',
    },

    // WIT
    dungeonLore: {
      name: 'Dungeon Lore',
      attribute: 'WIT',
      level: 1,
      description: 'Catalogues monsters, traps, and architecture obsessively.',
    },
    appraisal: {
      name: 'Appraisal',
      attribute: 'WIT',
      level: 1,
      description: 'Everything has a price. Everything can be assessed.',
    },
    wayfinding: {
      name: 'Wayfinding',
      attribute: 'WIT',
      level: 1,
      description: 'Reads rooms and tunnels like text.',
    },
    scavenging: {
      name: 'Scavenging',
      attribute: 'WIT',
      level: 1,
      description: 'Sees potential where others see waste.',
    },

    // STATION
    reputation: {
      name: 'Reputation',
      attribute: 'STATION',
      level: 1,
      description: 'Knows exactly what people say about you, and why.',
    },
    deception: {
      name: 'Deception',
      attribute: 'STATION',
      level: 1,
      description:
        'The social weapons of the powerless — misdirection, playing small.',
    },
    spite: {
      name: 'Spite',
      attribute: 'STATION',
      level: 1,
      description:
        'The chip on the shoulder as a fuel source. Dangerous when left unattended.',
    },

    // INSTINCT
    dangerSense: {
      name: 'Danger Sense',
      attribute: 'INSTINCT',
      level: 1,
      description:
        "Wordless and urgent. Doesn't explain itself — just insists.",
    },
    superstition: {
      name: 'Superstition',
      attribute: 'INSTINCT',
      level: 1,
      description:
        'Knows the old delver rituals and folk wisdom. Irrational but right.',
    },
    theDeep: {
      name: 'The Deep',
      attribute: 'INSTINCT',
      level: 1,
      description: "Slow, vast, barely verbal. Knows things it shouldn't.",
    },
  },

  setMode: (mode) => set({ gameMode: mode }),
}))
