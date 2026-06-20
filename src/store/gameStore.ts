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

export type CheckOutcome = 'passed' | 'passed_stressed' | 'failed'

export type BonusType = 'size_step_up' | 'ignore_stress' | 'unlock_choice'

export interface ActiveBonus {
  id: string
  type: BonusType
  skillKey?: SkillKey
  unlockKey?: string
  sourceDescription: string
}

export type PenaltyType = 'size_step_down' | 'add_stress_die' | 'lock_choice'

export interface ActivePenalty {
  id: string
  type: PenaltyType
  skillKey?: SkillKey
  lockKey?: string
  sourceDescription: string
}

export interface LogEntry {
  type: 'narrative' | 'choice' | 'interjection' | 'check'
  speaker: string
  text: string
  // Spoken aloud by an NPC rather than an internal skill voice (interjections).
  external?: boolean
  checkOutcome?: CheckOutcome
  checkRolls?: number[]
  checkDiceSize?: DiceSize
  passive?: boolean
  appliedBonus?: { type: BonusType; description: string }
  appliedPenalty?: { type: PenaltyType; description: string }
  // A beat-timed scene animation to fire when this entry is revealed.
  anim?: string
}

// An in-flight active check whose dice are being animated before the result
// is committed to the log.
export interface PendingRoll {
  rolls: number[]
  diceSize: DiceSize
  outcome: CheckOutcome
}

export type SkillKey = keyof Skills

export interface CharacterSelections {
  d6: [SkillKey, SkillKey]
  d8: [SkillKey, SkillKey]
  d10: SkillKey
}

// A bump to `warpSignal.id` tells the Phaser scene to teleport the player to a
// named destination (the scene owns the geometry). Carried via the store so a
// dialogue choice can drive an exploration-world warp.
export interface WarpSignal {
  target: string
  id: number
}

export type Room = 'deep' | 'center' | 'north' | 'east'

// Which rooms a given room connects to, for the navigation menu.
export const ROOM_ADJACENCY: Record<Room, Room[]> = {
  deep: ['north'],
  north: ['deep', 'center'],
  center: ['north', 'east'],
  east: ['center'],
}

interface GameState {
  gameMode: GameMode
  activeScenario: string | null
  currentRoom: Room
  // Set once the goblin chamber is resolved: 'escaped' (goblins alive, room is
  // one-way — refused on re-entry), 'cleared'/'fled' (room freely traversable).
  // 'monster_killed' — the chase ends with the monster tearing through the den
  // itself; the chamber is cleared, but not by the player.
  goblinOutcome: 'escaped' | 'cleared' | 'fled' | 'monster_killed' | null
  completedScenarios: string[]
  // Persists across scenario resets (unlike pendingBonuses, which can be
  // cleared/consumed) — survives a withdrawal and a later return to the room.
  hasMushroom: boolean
  goblinWithdrawn: boolean
  monsterState: 'sleeping' | 'chasing' | 'awake' | 'avoided'
  monsterCacheSeen: boolean
  hasTotem: boolean
  warpSignal: WarpSignal | null
  skills: Skills
  characterCreated: boolean
  currentNodeId: string
  // The beat sequence is revealed one step at a time. `beatCursor` is the index
  // of the next beat to process; `revealedBeats` is what has been shown so far
  // in the current node (voice lines + passed passive results).
  beatCursor: number
  revealedBeats: LogEntry[]
  dialogueLog: LogEntry[]
  flashingSkill: SkillKey | null
  pendingBonuses: ActiveBonus[]
  pendingPenalties: ActivePenalty[]
  // Cache of passive check outcomes keyed by "nodeId:beatIndex". Populated on
  // first roll; replayed on revisit so the player always sees the same result
  // and penalties are never double-applied.
  passiveCache: Record<string, { outcome: CheckOutcome; rolls: number[]; diceSize: DiceSize }>
  debugForceOutcome: CheckOutcome | null
  debugForcePassiveOutcome: CheckOutcome | null
  pendingRoll: PendingRoll | null
  pendingCommit: Partial<GameState> | null
  pendingFlashSkill: SkillKey | null
  resultFlash: { outcome: CheckOutcome; id: number } | null
  finalizeCharacter: (selections: CharacterSelections) => void
  setMode: (mode: GameMode) => void
  navigateTo: (room: Room) => void
  startScenario: (nodeId: string, scenario: string) => void
  openRefusal: () => void
  advanceBeat: () => void
  chooseOption: (choiceIndex: number) => void
  setDebugForce: (outcome: CheckOutcome | null) => void
  setDebugForcePassive: (outcome: CheckOutcome | null) => void
  gotoNode: (nodeId: string) => void
  commitRoll: () => void
  fireResultFlash: (outcome: CheckOutcome) => void
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

function stepDownSize(size: DiceSize): DiceSize {
  const i = DICE_SIZES.indexOf(size)
  return i > 0 ? DICE_SIZES[i - 1] : size
}

let bonusIdCounter = 0
function newBonusId() { return `bonus_${++bonusIdCounter}` }

let penaltyIdCounter = 0
function newPenaltyId() { return `penalty_${++penaltyIdCounter}` }

export const useGameStore = create<GameState>()((set, get) => ({
  gameMode: 'exploration',
  activeScenario: null,
  currentRoom: 'center',
  goblinOutcome: null,
  completedScenarios: [],
  hasMushroom: false,
  goblinWithdrawn: false,
  monsterState: 'sleeping',
  monsterCacheSeen: false,
  hasTotem: false,
  warpSignal: null,

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
  beatCursor: 0,
  revealedBeats: [],
  dialogueLog: [],
  flashingSkill: null,
  pendingBonuses: [],
  pendingPenalties: [],
  passiveCache: {},
  debugForceOutcome: null,
  debugForcePassiveOutcome: null,
  pendingRoll: null,
  pendingCommit: null,
  pendingFlashSkill: null,
  resultFlash: null,

  fireResultFlash: (outcome) =>
    set((s) => ({ resultFlash: { outcome, id: (s.resultFlash?.id ?? 0) + 1 } })),

  setDebugForce: (outcome) => set({ debugForceOutcome: outcome }),
  setDebugForcePassive: (outcome) => set({ debugForcePassiveOutcome: outcome }),

  // Apply the result of an animated active check once its dice have landed.
  commitRoll: () => {
    const { pendingCommit, pendingFlashSkill } = get()
    if (!pendingCommit) return
    set({ ...pendingCommit, pendingRoll: null, pendingCommit: null, pendingFlashSkill: null })
    if (pendingFlashSkill) setTimeout(() => set({ flashingSkill: null }), 1200)
  },

  // Debug: jump straight to a node, fresh (beats unrevealed, ready to roll).
  gotoNode: (nodeId) =>
    set(() => {
      if (!dialogueNodes[nodeId]) return {}
      return {
        currentNodeId: nodeId,
        beatCursor: 0,
        revealedBeats: [],
        pendingBonuses: [],
        pendingPenalties: [],
        passiveCache: {},
      }
    }),

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

  navigateTo: (room) => {
    const state = get()
    if (state.gameMode !== 'exploration') return
    if (state.currentRoom === room) return
    if (!ROOM_ADJACENCY[state.currentRoom].includes(room)) return

    if (room === 'deep') {
      if (state.goblinOutcome === 'escaped') { get().openRefusal(); return }
      if (state.goblinOutcome !== 'cleared' && state.goblinOutcome !== 'fled' && state.goblinOutcome !== 'monster_killed') return
    }

    set({ currentRoom: room })

    if (room === 'north' && state.goblinOutcome === null) {
      get().startScenario('goblin_start', 'goblin')
    } else if (room === 'east' && state.monsterState === 'sleeping') {
      get().startScenario('monster_start', 'monster')
    } else if (room === 'east' && state.monsterState === 'awake' && !state.monsterCacheSeen) {
      const cacheNode = state.goblinOutcome === 'monster_killed' ? 'monster_cache_found_killed' : 'monster_cache_found'
      get().startScenario(cacheNode, 'monster_cache')
    }
  },

  // Enter dialogue from the exploration view: switch mode, set active scenario
  // (used to filter debug tools), and navigate to the entry node fresh.
  startScenario: (nodeId, scenario) => {
    const state = get()
    // Resuming after a withdrawal: skip the intro/observation beats (they've
    // already played and shouldn't replay) and pick back up at the approach —
    // re-seeding the mushroom unlock if the player still has it banked.
    const resuming = scenario === 'goblin' && state.goblinWithdrawn && nodeId === 'goblin_start'
    const resumeNodeId = resuming ? 'goblin_approach' : nodeId
    if (!dialogueNodes[resumeNodeId]) return
    set({
      gameMode: 'dialogue',
      activeScenario: scenario,
      currentNodeId: resumeNodeId,
      beatCursor: 0,
      revealedBeats: [],
      pendingBonuses: state.hasMushroom
        ? [{ id: newBonusId(), type: 'unlock_choice', unlockKey: 'poison', sourceDescription: 'Corpse-veil, still in your coat' }]
        : [],
      pendingPenalties: [],
      passiveCache: {},
      dialogueLog: [],
    })
  },

  // Open the short "I'm not going back" refusal when the player tries to walk
  // back into a chamber they've already left.
  openRefusal: () => {
    set({
      gameMode: 'dialogue',
      activeScenario: 'goblin',
      currentNodeId: 'goblin_refuse',
      beatCursor: 0,
      revealedBeats: [],
      pendingBonuses: [],
      pendingPenalties: [],
      passiveCache: {},
      dialogueLog: [],
    })
  },

  // Reveal the next beat. Voice beats reveal directly; passive beats roll the
  // moment they are reached — on a pass they reveal a tag + message (and grant
  // any bonus), on a fail they are silently skipped (processing continues to
  // the next beat so the click always surfaces something, or reaches the end).
  advanceBeat: () => {
    const state = get()
    const beats = dialogueNodes[state.currentNodeId].beats
    let cursor = state.beatCursor
    const revealed = [...state.revealedBeats]
    let bonuses = state.pendingBonuses
    let penalties = state.pendingPenalties
    let gotMushroom = false
    const force = state.debugForcePassiveOutcome
    let forceConsumed = false
    let revealedSomething = false
    const newPassiveCache: GameState['passiveCache'] = {}

    while (cursor < beats.length && !revealedSomething) {
      const beat = beats[cursor]
      if (beat.kind === 'voice') {
        revealed.push({ type: 'interjection', speaker: beat.speaker, text: beat.text, external: beat.external, anim: beat.anim })
        if (beat.penalties?.length) {
          penalties = [...penalties, ...beat.penalties.map((p) => ({ ...p, id: newPenaltyId() }))]
        }
        if (beat.bonuses?.length) {
          bonuses = [...bonuses, ...beat.bonuses.map((b) => ({ ...b, id: newBonusId() }))]
        }
        cursor++
        revealedSomething = true
      } else {
        const skill = state.skills[beat.skillKey]
        const cacheKey = `${state.currentNodeId}:${cursor}`
        const cached = state.passiveCache[cacheKey]
        const isReplay = !!cached

        let rolls: number[]
        let effectiveSize: DiceSize

        if (cached) {
          // Replay the same result — don't re-roll, don't re-apply effects.
          rolls = cached.rolls
          effectiveSize = cached.diceSize
        } else {
          // Auto-pass if a size_step_up bonus for the guaranteedBy skill is pending.
          let guaranteed = false
          if (beat.guaranteedBy) {
            const gIdx = bonuses.findIndex(
              (b) => b.type === 'size_step_up' && b.skillKey === beat.guaranteedBy
            )
            if (gIdx >= 0) {
              guaranteed = true
              bonuses = bonuses.filter((_, i) => i !== gIdx)
            }
          }

          // Consume a pending size_step_up bonus for this passive skill if present.
          const sizeUpIdx = bonuses.findIndex(
            (b) => b.type === 'size_step_up' && b.skillKey === beat.skillKey
          )
          effectiveSize = skill.size
          if (sizeUpIdx >= 0) {
            effectiveSize = stepUpSize(skill.size)
            bonuses = bonuses.filter((_, i) => i !== sizeUpIdx)
          }

          const size = parseInt(effectiveSize.slice(1))
          const forceThis = force && !forceConsumed ? force : null
          // Only consume the force when this beat has visible output for that
          // outcome — otherwise let it pass through to the next passive beat.
          if (forceThis) {
            const hasVisible = forceThis === 'failed' ? !!beat.failInterjection : !!beat.successInterjection
            if (hasVisible) forceConsumed = true
          }
          rolls = guaranteed
            ? forcedRolls(skill.pool, size, 'passed')
            : forceThis
            ? forcedRolls(skill.pool, size, forceThis)
            : rollDice(skill.pool, size)
        }

        const passed = !rolls.some((r) => r === 1)
        const outcome: CheckOutcome = passed ? 'passed' : 'failed'
        if (!cached) {
          newPassiveCache[cacheKey] = { outcome, rolls, diceSize: effectiveSize }
        }

        cursor++
        if (passed && beat.successInterjection) {
          revealed.push({
            type: 'check',
            speaker: skill.name.toUpperCase(),
            text: '',
            checkOutcome: 'passed',
            checkRolls: rolls,
            checkDiceSize: effectiveSize,
            passive: true,
          })
          revealed.push({
            type: 'interjection',
            speaker: beat.successInterjection.speaker,
            text: beat.successInterjection.text,
            anim: beat.anim,
          })
          if (!isReplay && beat.successBonuses?.length) {
            bonuses = [...bonuses, ...beat.successBonuses.map((b) => ({ ...b, id: newBonusId() }))]
            if (beat.successBonuses.some((b) => b.unlockKey === 'poison')) gotMushroom = true
          }
          revealedSomething = true
        } else if (passed) {
          // Silent pass — apply bonuses only on the first roll, continue loop.
          if (!isReplay && beat.successBonuses?.length) {
            bonuses = [...bonuses, ...beat.successBonuses.map((b) => ({ ...b, id: newBonusId() }))]
            if (beat.successBonuses.some((b) => b.unlockKey === 'poison')) gotMushroom = true
          }
        } else if (beat.failInterjection) {
          revealed.push({
            type: 'check',
            speaker: skill.name.toUpperCase(),
            text: '',
            checkOutcome: 'failed',
            checkRolls: rolls,
            checkDiceSize: effectiveSize,
            passive: true,
          })
          revealed.push({
            type: 'interjection',
            speaker: beat.failInterjection.speaker,
            text: beat.failInterjection.text,
          })
          if (!isReplay && beat.failPenalties?.length) {
            penalties = [...penalties, ...beat.failPenalties.map((p) => ({ ...p, id: newPenaltyId() }))]
          }
          revealedSomething = true
        }
        // on fail with no failInterjection: nothing revealed, loop continues
      }
    }

    set({
      beatCursor: cursor,
      revealedBeats: revealed,
      ...(gotMushroom ? { hasMushroom: true } : {}),
      pendingBonuses: bonuses,
      pendingPenalties: penalties,
      passiveCache: { ...state.passiveCache, ...newPassiveCache },
      ...(forceConsumed ? { debugForcePassiveOutcome: null } : {}),
    })
  },

  chooseOption: (choiceIndex) => {
    const state = get()
    const node = dialogueNodes[state.currentNodeId]
    const choice = node.choices[choiceIndex]

    // Flush the narrator line and everything revealed this node into history.
    const baseLog: LogEntry[] = [
      { type: 'narrative', speaker: 'NARRATOR', text: node.narrative },
      ...state.revealedBeats,
      { type: 'choice', speaker: 'YOU', text: choice.text },
    ]

    // A choice gated by an unlock consumes that unlock bonus when taken.
    const bonusesAfterUnlock = choice.requiresUnlock
      ? state.pendingBonuses.filter(
          (b) => !(b.type === 'unlock_choice' && b.unlockKey === choice.requiresUnlock)
        )
      : state.pendingBonuses

    // Leaving the chamber ends the scenario and hands control back to the
    // exploration view. Two outcomes:
    //   goblin_exit    — escaped/talked past (goblins still alive) → warp 'deep'
    //   goblin_cleared — killed all three → stay in the chamber, now emptied
    const EXIT_WARP: Record<string, string> = {
      goblin_exit: 'deep',
      goblin_cleared: 'cleared',
      goblin_fled: 'emptied',
    }
    // Pulling back: leave the chamber unresolved and return to the center room.
    // Doesn't mark the scenario complete — the player can come back later.
    if (!choice.check && choice.nextNodeId === 'goblin_withdraw') {
      set({
        gameMode: 'exploration',
        activeScenario: null,
        goblinWithdrawn: true,
        currentRoom: 'center',
        warpSignal: { target: 'center', id: (state.warpSignal?.id ?? 0) + 1 },
        currentNodeId: choice.nextNodeId,
        beatCursor: 0,
        revealedBeats: [],
        pendingBonuses: bonusesAfterUnlock,
        pendingPenalties: state.pendingPenalties,
        passiveCache: state.passiveCache,
        dialogueLog: [],
      })
      return
    }

    // The east-room cache, found once the monster's gone — a one-time pickup,
    // no room/warp change since the player never left the east room for it.
    const CACHE_EXIT: Record<string, boolean> = {
      monster_cache_take: true,
      monster_cache_skip: false,
    }
    if (!choice.check && choice.nextNodeId in CACHE_EXIT) {
      set({
        gameMode: 'exploration',
        activeScenario: null,
        monsterCacheSeen: true,
        hasTotem: CACHE_EXIT[choice.nextNodeId],
        completedScenarios: state.completedScenarios.includes('monster_cache')
          ? state.completedScenarios
          : [...state.completedScenarios, 'monster_cache'],
        currentNodeId: choice.nextNodeId,
        beatCursor: 0,
        revealedBeats: [],
        pendingBonuses: [],
        pendingPenalties: [],
        passiveCache: {},
        dialogueLog: [],
      })
      return
    }

    // Monster scenario terminals: 'avoided' stays in the east room and resets
    // the trigger (revisitable, like a goblin withdrawal); the chase-end nodes
    // mark the encounter resolved and physically land the player elsewhere.
    // The north-break ends with the den itself torn through (text confirms the
    // goblins are gone, definitively) — the circle-back is deliberately left
    // ambiguous in the prose, so it carries no goblinOutcome change at all.
    const MONSTER_EXIT: Record<string, {
      warp: string
      room: GameState['currentRoom']
      state: GameState['monsterState']
      goblinOutcome?: GameState['goblinOutcome']
    }> = {
      monster_leave: { warp: 'monster_stay', room: 'east', state: 'avoided' },
      monster_chase_north: { warp: 'monster_cleared', room: 'deep', state: 'awake', goblinOutcome: 'monster_killed' },
      monster_chase_circle: { warp: 'center', room: 'center', state: 'awake' },
    }
    if (!choice.check && MONSTER_EXIT[choice.nextNodeId]) {
      const exit = MONSTER_EXIT[choice.nextNodeId]
      const scenario = state.activeScenario ?? 'monster'
      set({
        gameMode: 'exploration',
        activeScenario: null,
        currentRoom: exit.room,
        monsterState: exit.state,
        goblinOutcome: exit.goblinOutcome ?? state.goblinOutcome,
        completedScenarios: exit.state === 'avoided' || state.completedScenarios.includes(scenario)
          ? state.completedScenarios
          : [...state.completedScenarios, scenario],
        warpSignal: { target: exit.warp, id: (state.warpSignal?.id ?? 0) + 1 },
        currentNodeId: choice.nextNodeId,
        beatCursor: 0,
        revealedBeats: [],
        pendingBonuses: [],
        pendingPenalties: [],
        passiveCache: {},
        dialogueLog: [],
      })
      return
    }

    if (!choice.check && EXIT_WARP[choice.nextNodeId]) {
      const scenario = state.activeScenario ?? 'goblin'
      const warp = EXIT_WARP[choice.nextNodeId]
      const OUTCOME_FOR_WARP: Record<string, GameState['goblinOutcome']> = {
        deep: 'escaped', cleared: 'cleared', emptied: 'fled',
      }
      const ROOM_FOR_WARP: Record<string, GameState['currentRoom']> = {
        deep: 'deep', cleared: 'north', emptied: 'north',
      }
      set({
        gameMode: 'exploration',
        activeScenario: null,
        currentRoom: ROOM_FOR_WARP[warp] ?? state.currentRoom,
        goblinOutcome: OUTCOME_FOR_WARP[warp] ?? state.goblinOutcome,
        completedScenarios: state.completedScenarios.includes(scenario)
          ? state.completedScenarios
          : [...state.completedScenarios, scenario],
        warpSignal: { target: EXIT_WARP[choice.nextNodeId], id: (state.warpSignal?.id ?? 0) + 1 },
        currentNodeId: choice.nextNodeId,
        beatCursor: 0,
        revealedBeats: [],
        pendingBonuses: [],
        pendingPenalties: [],
        passiveCache: {},
        dialogueLog: [],
      })
      return
    }

    if (!choice.check) {
      set({
        currentNodeId: choice.nextNodeId,
        beatCursor: 0,
        revealedBeats: [],
        // A sequence-resetting choice (death) wipes carried state so the
        // restart is a genuinely fresh run.
        pendingBonuses: choice.resetsSequence ? [] : bonusesAfterUnlock,
        pendingPenalties: choice.resetsSequence ? [] : state.pendingPenalties,
        passiveCache: choice.resetsSequence ? {} : state.passiveCache,
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
    const ignoringStress = bonus?.type === 'ignore_stress'

    // Apply and consume applicable penalties
    let remainingPenalties = state.pendingPenalties
    let appliedPenalty: LogEntry['appliedPenalty'] | undefined
    const penaltyDescs: string[] = []
    // Size penalties that land while the die is already at the minimum get
    // converted into permanent stress dice on the skill's pool instead.
    let permanentStressDice = 0

    // Consume every size_step_down penalty for this skill. Each steps the die
    // down one notch; once the die is already at the minimum (d4), each further
    // point permanently adds a stress die to the skill's pool instead.
    let sizeDownIdx = remainingPenalties.findIndex(
      (p) => p.type === 'size_step_down' && p.skillKey === skillKey
    )
    while (sizeDownIdx >= 0) {
      const p = remainingPenalties[sizeDownIdx]
      const stepped = stepDownSize(effectiveSize)
      if (stepped !== effectiveSize) {
        penaltyDescs.push(`${effectiveSize} → ${stepped} (${p.sourceDescription})`)
        effectiveSize = stepped
      } else {
        permanentStressDice += 1
        penaltyDescs.push(`min size — +1 permanent stress die (${p.sourceDescription})`)
      }
      remainingPenalties = remainingPenalties.filter((_, i) => i !== sizeDownIdx)
      sizeDownIdx = remainingPenalties.findIndex(
        (p) => p.type === 'size_step_down' && p.skillKey === skillKey
      )
    }

    const stressDieIdx = remainingPenalties.findIndex(
      (p) => p.type === 'add_stress_die' && p.skillKey === skillKey
    )
    if (stressDieIdx >= 0) {
      const p = remainingPenalties[stressDieIdx]
      penaltyDescs.push(`+1 stress die (${p.sourceDescription})${ignoringStress ? ' — ignored' : ''}`)
      if (!ignoringStress) effectivePool += 1
      remainingPenalties = remainingPenalties.filter((_, i) => i !== stressDieIdx)
    }

    // Fold any converted size penalties into the pool — both for this check and
    // permanently on the skill (committed below alongside any stress-pass gain).
    const permanentPool = skill.pool + permanentStressDice
    if (!ignoringStress) effectivePool += permanentStressDice

    if (penaltyDescs.length) {
      appliedPenalty = {
        type: permanentStressDice > 0 ? 'add_stress_die' : 'size_step_down',
        description: penaltyDescs.join('; '),
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
    // Bank any permanent stress dice the size penalties converted into.
    let updatedSkills: Skills = permanentStressDice > 0
      ? { ...state.skills, [skillKey]: { ...skill, pool: permanentPool } }
      : state.skills
    // A permanent pool change is worth flashing the skill for, same as a
    // stress-pass gain.
    let flashingSkill: SkillKey | null = permanentStressDice > 0 ? skillKey : null

    if (hasFailed) {
      outcome = 'failed'
      if (failNodeId) nextNodeId = failNodeId
    } else if (hasOdd) {
      outcome = 'passed_stressed'
      if (permanentPool < 8) {
        updatedSkills = { ...updatedSkills, [skillKey]: { ...updatedSkills[skillKey], pool: permanentPool + 1 } }
        flashingSkill = skillKey
        // flash is scheduled at commit time (after the dice settle)
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
      appliedPenalty,
    }

    const remainingBonuses = bonus
      ? bonusesAfterUnlock.filter((_, i) => i !== bonusIdx)
      : bonusesAfterUnlock

    // The result is fully computed, but we defer applying it until the dice
    // animation finishes (commitRoll). Stash the resolution and surface the
    // roll for the animator.
    const resolution: Partial<GameState> = {
      currentNodeId: nextNodeId,
      beatCursor: 0,
      revealedBeats: [],
      skills: updatedSkills,
      flashingSkill,
      pendingBonuses: remainingBonuses,
      pendingPenalties: remainingPenalties,
      debugForceOutcome: null,
      dialogueLog: [...state.dialogueLog, ...baseLog, checkEntry],
    }

    set({
      pendingRoll: { rolls, diceSize: effectiveSize, outcome },
      pendingCommit: resolution,
      pendingFlashSkill: flashingSkill,
    })
  },
}))
