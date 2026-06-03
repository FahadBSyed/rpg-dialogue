import { create } from 'zustand'
import { dialogueNodes } from '../data/dialogueData'
import type { PassiveCheckDef } from '../data/dialogueData'

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

export type CheckOutcome = 'passed' | 'passed_stressed' | 'failed'

export type BonusType = 'size_step_up' | 'ignore_stress' | 'unlock_choice'

export interface ActiveBonus {
  id: string
  type: BonusType
  skillKey?: SkillKey
  unlockKey?: string
  sourceDescription: string
}

export interface LogEntry {
  type: 'narrative' | 'choice' | 'interjection' | 'check'
  speaker: string
  text: string
  checkOutcome?: CheckOutcome
  checkRolls?: number[]
  checkDiceSize?: DiceSize
  passive?: boolean
  appliedBonus?: { type: BonusType; description: string }
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
  flashingSkill: SkillKey | null
  resolvedPassiveNodes: Set<string>
  pendingPassiveResults: LogEntry[]
  injectedInterjections: { speaker: string; text: string }[]
  pendingBonuses: ActiveBonus[]
  debugForceOutcome: CheckOutcome | null
  finalizeCharacter: (selections: CharacterSelections) => void
  setMode: (mode: GameMode) => void
  advanceInterjection: () => void
  chooseOption: (choiceIndex: number) => void
  triggerPassiveChecks: (nodeId: string, checks: PassiveCheckDef[]) => void
  setDebugForce: (outcome: CheckOutcome | null) => void
}

function rollDice(pool: number, size: number): number[] {
  return Array.from({ length: pool }, () => Math.floor(Math.random() * size) + 1)
}

// Returns synthetic rolls that will produce the requested outcome.
// pass → all evens, stress → at least one odd (no 1s), fail → at least one 1.
function forcedRolls(pool: number, size: number, outcome: CheckOutcome): number[] {
  const rolls = Array.from({ length: pool }, () => Math.floor(Math.random() * size) + 1)
  if (outcome === 'failed') {
    rolls[0] = 1
    return rolls
  }
  if (outcome === 'passed_stressed') {
    // ensure no 1s, at least one odd
    return rolls.map((r, i) => {
      const safe = r === 1 ? 3 : r
      return i === 0 ? (safe % 2 === 0 ? (safe + 1 <= size ? safe + 1 : safe - 1) : safe) : (safe === 1 ? 3 : safe)
    })
  }
  // passed → all even, no 1s
  return rolls.map((r) => {
    if (r % 2 !== 0 || r === 1) return r + 1 <= size ? r + 1 : r - 1
    return r
  })
}

const DICE_SIZES: DiceSize[] = ['d4', 'd6', 'd8', 'd10', 'd12']

function stepUpSize(size: DiceSize): DiceSize {
  const i = DICE_SIZES.indexOf(size)
  return i < DICE_SIZES.length - 1 ? DICE_SIZES[i + 1] : size
}

let bonusIdCounter = 0
function newBonusId() { return `bonus_${++bonusIdCounter}` }

export const useGameStore = create<GameState>()((set, get) => ({
  gameMode: 'dialogue',

  skills: {
    // FLESH
    endurance: {
      name: 'Endurance',
      attribute: 'FLESH',
      size: 'd4', pool: 1,
      description: "The body's refusal to quit — slow, stubborn, almost bovine.",
    },
    scarring: {
      name: 'Scarring',
      attribute: 'FLESH',
      size: 'd4', pool: 1,
      description: 'Every wound remembers the thing that made it.',
    },
    hunger: {
      name: 'Hunger',
      attribute: 'FLESH',
      size: 'd4', pool: 1,
      description:
        'Recognizes compulsion and appetite in all their forms — including your own.',
    },

    // WIT
    dungeonLore: {
      name: 'Dungeon Lore',
      attribute: 'WIT',
      size: 'd4', pool: 1,
      description: 'Catalogues monsters, traps, and architecture obsessively.',
    },
    appraisal: {
      name: 'Appraisal',
      attribute: 'WIT',
      size: 'd4', pool: 1,
      description: 'Everything has a price. Everything can be assessed.',
    },
    wayfinding: {
      name: 'Wayfinding',
      attribute: 'WIT',
      size: 'd4', pool: 1,
      description: 'Reads rooms and tunnels like text.',
    },
    scavenging: {
      name: 'Scavenging',
      attribute: 'WIT',
      size: 'd4', pool: 1,
      description: 'Sees potential where others see waste.',
    },

    // STATION
    reputation: {
      name: 'Reputation',
      attribute: 'STATION',
      size: 'd4', pool: 1,
      description: 'Knows exactly what people say about you, and why.',
    },
    deception: {
      name: 'Deception',
      attribute: 'STATION',
      size: 'd4', pool: 1,
      description:
        'The social weapons of the powerless — misdirection, playing small.',
    },
    spite: {
      name: 'Spite',
      attribute: 'STATION',
      size: 'd4', pool: 1,
      description:
        'The chip on the shoulder as a fuel source. Dangerous when left unattended.',
    },

    // INSTINCT
    dangerSense: {
      name: 'Danger Sense',
      attribute: 'INSTINCT',
      size: 'd4', pool: 1,
      description:
        "Wordless and urgent. Doesn't explain itself — just insists.",
    },
    superstition: {
      name: 'Superstition',
      attribute: 'INSTINCT',
      size: 'd4', pool: 1,
      description:
        'Knows the old delver rituals and folk wisdom. Irrational but right.',
    },
    theDeep: {
      name: 'The Deep',
      attribute: 'INSTINCT',
      size: 'd4', pool: 1,
      description: "Slow, vast, barely verbal. Knows things it shouldn't.",
    },
  },

  characterCreated: false,
  currentNodeId: 'goblin_start',
  currentInterjectionIndex: 0,
  dialogueLog: [],
  flashingSkill: null,
  resolvedPassiveNodes: new Set(),
  pendingPassiveResults: [],
  injectedInterjections: [],
  pendingBonuses: [],
  debugForceOutcome: null,

  setDebugForce: (outcome) => set({ debugForceOutcome: outcome }),

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

  chooseOption: (choiceIndex) => {
    const state = get()
    const node = dialogueNodes[state.currentNodeId]
    const choice = node.choices[choiceIndex]

    // Flush passive results and injected interjections into history
    const injectedLog: LogEntry[] = state.injectedInterjections.map((i) => ({
      type: 'interjection' as const,
      speaker: i.speaker,
      text: i.text,
    }))

    const baseLog: LogEntry[] = [
      { type: 'narrative', speaker: 'NARRATOR', text: node.narrative },
      ...state.pendingPassiveResults,
      ...injectedLog,
      ...node.interjections.map((i) => ({
        type: 'interjection' as const,
        speaker: i.speaker,
        text: i.text,
      })),
      { type: 'choice', speaker: 'YOU', text: choice.text },
    ]

    // A choice gated by an unlock consumes that unlock bonus when taken.
    const bonusesAfterUnlock = choice.requiresUnlock
      ? state.pendingBonuses.filter(
          (b) => !(b.type === 'unlock_choice' && b.unlockKey === choice.requiresUnlock)
        )
      : state.pendingBonuses

    if (!choice.check) {
      set({
        currentNodeId: choice.nextNodeId,
        currentInterjectionIndex: 0,
        pendingPassiveResults: [],
        injectedInterjections: [],
        pendingBonuses: bonusesAfterUnlock,
        dialogueLog: [...state.dialogueLog, ...baseLog],
      })
      return
    }

    const { skillKey, failNodeId } = choice.check
    const skill = state.skills[skillKey]

    // Check for an applicable pending bonus (unlock already consumed above)
    const bonusIdx = bonusesAfterUnlock.findIndex(
      (b) => (b.type === 'size_step_up' || b.type === 'ignore_stress') && b.skillKey === skillKey
    )
    const bonus = bonusIdx >= 0 ? bonusesAfterUnlock[bonusIdx] : null

    let effectiveSize = skill.size
    let effectivePool = skill.pool
    let appliedBonus: LogEntry['appliedBonus'] | undefined

    if (bonus) {
      if (bonus.type === 'size_step_up') {
        const stepped = stepUpSize(skill.size)
        appliedBonus = { type: bonus.type, description: `${skill.size} → ${stepped} (${bonus.sourceDescription})` }
        effectiveSize = stepped
      } else if (bonus.type === 'ignore_stress') {
        appliedBonus = { type: bonus.type, description: `stress ignored (${bonus.sourceDescription})` }
        effectivePool = 1
      }
    }

    const diceSize = parseInt(effectiveSize.slice(1))
    const forced = state.debugForceOutcome
    const rolls = forced
      ? forcedRolls(effectivePool, diceSize, forced)
      : rollDice(effectivePool, diceSize)

    const hasFailed = rolls.some((r) => r === 1)
    const hasOdd = !hasFailed && rolls.some((r) => r % 2 !== 0)

    let outcome: CheckOutcome
    let nextNodeId = choice.nextNodeId
    let updatedSkills = state.skills
    let flashingSkill: SkillKey | null = null

    if (hasFailed) {
      outcome = 'failed'
      if (failNodeId) nextNodeId = failNodeId
    } else if (hasOdd) {
      outcome = 'passed_stressed'
      if (skill.pool < 8) {
        updatedSkills = { ...state.skills, [skillKey]: { ...skill, pool: skill.pool + 1 } }
        flashingSkill = skillKey
        setTimeout(() => set({ flashingSkill: null }), 1200)
      }
    } else {
      outcome = 'passed'
    }

    const checkEntry: LogEntry = {
      type: 'check',
      speaker: skill.name.toUpperCase(),
      text: '',
      checkOutcome: outcome,
      checkRolls: rolls,
      checkDiceSize: effectiveSize,
      appliedBonus,
    }

    const remainingBonuses = bonus
      ? bonusesAfterUnlock.filter((_, i) => i !== bonusIdx)
      : bonusesAfterUnlock

    set({
      currentNodeId: nextNodeId,
      currentInterjectionIndex: 0,
      skills: updatedSkills,
      flashingSkill,
      pendingPassiveResults: [],
      injectedInterjections: [],
      pendingBonuses: remainingBonuses,
      debugForceOutcome: null,
      dialogueLog: [...state.dialogueLog, ...baseLog, checkEntry],
    })
  },

  triggerPassiveChecks: (nodeId, checks) => {
    const state = get()
    if (state.resolvedPassiveNodes.has(nodeId)) return

    const forced = state.debugForceOutcome
    const results: LogEntry[] = []
    const injected = [...state.injectedInterjections]
    const bonuses = [...state.pendingBonuses]

    checks.forEach((pc) => {
      const skill = state.skills[pc.skillKey]
      const diceSize = parseInt(skill.size.slice(1))
      const rolls = forced
        ? forcedRolls(skill.pool, diceSize, forced)
        : rollDice(skill.pool, diceSize)
      const passed = !rolls.some((r) => r === 1)

      results.push({
        type: 'check',
        speaker: skill.name.toUpperCase(),
        text: '',
        checkOutcome: passed ? 'passed' : 'failed',
        checkRolls: rolls,
        checkDiceSize: skill.size,
        passive: true,
      })

      if (passed && pc.successInterjection) injected.push(pc.successInterjection)
      if (passed && pc.successBonus) bonuses.push({ ...pc.successBonus, id: newBonusId() })
    })

    const resolved = new Set(state.resolvedPassiveNodes)
    resolved.add(nodeId)

    set({
      resolvedPassiveNodes: resolved,
      pendingPassiveResults: results,
      injectedInterjections: injected,
      pendingBonuses: bonuses,
      debugForceOutcome: null,
    })
  },
}))
