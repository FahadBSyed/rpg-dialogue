import type { SkillKey, BonusType, PenaltyType } from '../store/gameStore'

export interface DialogueChoice {
  // Stable handle for referring to this link in conversation, e.g.
  // "link goblin_spotted/bolt to ...". Unique within its node.
  id?: string
  text: string
  nextNodeId: string
  check?: { skillKey: SkillKey; failNodeId?: string }
  // Only shown when a matching `unlock_choice` bonus is currently pending.
  requiresUnlock?: string
  // Hidden when a matching `unlock_choice` bonus is currently pending.
  suppressedBy?: string
  // Hidden when a matching `lock_choice` penalty is currently active.
  lockedBy?: string
  // Wipes all carried state (bonuses, penalties, cached passive rolls) on the
  // way out — used by death to make the restart a genuinely fresh run.
  resetsSequence?: boolean
}

export interface Interjection {
  id?: string
  speaker: string
  text: string
}

// A node's content is an ordered list of "beats" the player advances through
// one at a time. A beat is either a skill's voice line, or a passive check
// that is rolled at the moment it is reached — on a pass it reveals its
// message (and any bonus); on a fail it is silently skipped.
// A named scene animation that should fire when a specific beat is revealed,
// rather than at node entry. Lets the visual land on the line that describes it
// (e.g. the creep-to-fire plays on "your hand is in the meat", not on entry).
export type BeatAnim = 'poisonStew' | 'sneakForward' | 'strike' | 'flee'

export interface VoiceBeat {
  kind: 'voice'
  id?: string
  speaker: string
  text: string
  // Fire this scene animation when this beat is revealed (beat-timed action).
  anim?: BeatAnim
  // True for lines spoken aloud by an NPC (overheard or directed at Fiodor),
  // as opposed to the internal skill voices. Rendered in a distinct style.
  external?: boolean
  penalties?: Array<{ type: PenaltyType; skillKey?: SkillKey; lockKey?: string; sourceDescription: string }>
  // Bonuses granted unconditionally when this beat is reached — for moments
  // that help no matter the roll (e.g. throwing the mushroom always sows a
  // little confusion). Mirrors `penalties`.
  bonuses?: Array<{ type: BonusType; skillKey?: SkillKey; unlockKey?: string; sourceDescription: string }>
}

export interface PassiveBeat {
  kind: 'passive'
  id?: string
  skillKey: SkillKey
  // Fire this scene animation when this passive's success interjection shows.
  anim?: BeatAnim
  // Omit for a silent pass — bonuses still apply, nothing shown.
  successInterjection?: Interjection
  successBonuses?: Array<{ type: BonusType; skillKey?: SkillKey; unlockKey?: string; sourceDescription: string }>
  // Auto-passes if a size_step_up bonus for this skill is pending (the player
  // already did the work — the grab is certain).
  guaranteedBy?: SkillKey
  failInterjection?: Interjection
  failPenalties?: Array<{ type: PenaltyType; skillKey?: SkillKey; lockKey?: string; sourceDescription: string }>
}

export type Beat = VoiceBeat | PassiveBeat

export interface DialogueNode {
  id: string
  narrative: string
  beats: Beat[]
  choices: DialogueChoice[]
}

// ── The Goblin Chamber ──────────────────────────────────────────────────────
// Three goblins between Fiodor and the passage onward. Built in passes; new
// approaches branch from `goblin_start`. Passive checks are interleaved into
// the beat sequence at authored positions and roll when reached.
//
// The cast (external voices, `external: true` — spoken aloud, overheard or
// directed at Fiodor, rendered distinctly from the internal skill voices):
//
//   GRIT — the pacer. Carries the whip; the only real threat in the room.
//     Older, scarred, terse. Keeps watch while the other two squabble because
//     keeping watch is the only thing that's kept him alive this long. Tired of
//     it. Menace built on competence, not cruelty. (Ambush kills him first.)
//
//   NIM — the schemer. Found the bright thing (a tarnished brass buckle) and
//     will not let it go. Quick, greedy, sharp-tongued, petty-cruel. Fast
//     wheedling cadence. The one who curses you as you flee.
//
//   BOLE — the big one. Slow, hungry, sentimental, plain-spoken. The most
//     sympathetic: he just wants to eat and he half-likes the buckle because
//     it's pretty. Hesitates to kill. The hungriest — so the poison takes him.

export const dialogueNodes: Record<string, DialogueNode> = {
  goblin_start: {
    id: 'goblin_start',
    narrative:
      'The tunnel opens into a low chamber and you stop before your boot finds the light. Three goblins. A cookfire, something on a spit above it that you decide not to identify, a scatter of bones and dented tin. Two of them crouch arguing over a small bright thing. The third paces the far edge of the firelight — back and forth, past the second passage. The passage you need. None of them have seen you. Not yet.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Mine. I pulled it out of the muck, so I get to say, and I say mine. That\'s the rule. That\'s always been the rule.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'The meat\'s done, Nim. It\'s been done. I can hear my own stomach. Listen — there. You hear that? That\'s a wolf noise. That\'s a wolf living in me.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Both of you. Quieter. The dark\'s been wrong since sundown.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Three. Don\'t count them again — you\'ve counted them. The pacing one is the only one that matters. The other two are noise. Watch his feet. Not his hands. His feet tell you where he\'s about to not be looking.',
      },
      // Wayfinding reads the room. On a pass it maps the gap and steps up the
      // Danger Sense sneak that follows.
      {
        kind: 'passive',
        skillKey: 'wayfinding',
        successInterjection: {
          speaker: 'WAYFINDING',
          text: 'The room is three steps and a shadow. The pacing one walks a circuit — fire, wall, passage, back. Eleven seconds, give or take. There is a dead angle behind the rubble pile, left of centre, where none of the three can see at once. Wait in the dark. Move on the turn. Stand in that angle and let the circuit close around nothing.',
        },
        successBonuses: [{
          type: 'size_step_up',
          skillKey: 'dangerSense',
          sourceDescription: 'Wayfinding mapped the gap',
        }],
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'You\'ve crept past worse than this. The trick is forgetting you have a body — no breath, no weight, no old knee that clicks at the wrong moment. Leave the body here at the threshold. You can come back for it once you\'re across.',
      },
      // Scavenging spots something poisonous. On a pass it unlocks the poison
      // approach.
      {
        kind: 'passive',
        skillKey: 'scavenging',
        successInterjection: {
          speaker: 'SCAVENGING',
          text: 'There — the pale fungus clustered on the damp wall behind the rubble. Corpse-veil. It only grows where something died and it keeps a little of whatever did the killing. A crushed handful worked into something they\'re about to eat would be more than enough. Waste not.',
        },
        successBonuses: [{
          type: 'unlock_choice',
          unlockKey: 'poison',
          sourceDescription: 'Scavenging found corpse-veil',
        }],
      },
    ],
    choices: [
      { id: 'forward', text: 'You\'ve read the room.', nextNodeId: 'goblin_approach' },
    ],
  },

  // Terminal node for every successful exit from the goblin chamber. Reaching it
  // is intercepted in chooseOption: the game leaves dialogue, marks the goblin
  // scenario complete, and warps the player into the deep room to the north.
  // It is never actually rendered (mode flips to exploration first).
  goblin_exit: {
    id: 'goblin_exit',
    narrative: 'The chamber falls away behind you. The dark ahead is colder.',
    beats: [],
    choices: [],
  },

  // Terminal node for clearing the chamber by killing all three goblins. Like
  // goblin_exit, it is intercepted in chooseOption — but instead of warping to
  // the deep room it leaves the player standing in the now-emptied chamber (the
  // goblins replaced by splatters, the north passage open). Never rendered.
  goblin_cleared: {
    id: 'goblin_cleared',
    narrative: 'The chamber is yours now. The only sound is the fire.',
    beats: [],
    choices: [],
  },

  // Terminal node for emptying the chamber by driving the goblins out (they flee
  // alive). Like goblin_cleared the player stays and the room is freely
  // re-enterable — but there are no bodies, just an abandoned fire. Never rendered.
  goblin_fled: {
    id: 'goblin_fled',
    narrative: 'The chamber is empty. The fire ticks down over an abandoned spit.',
    beats: [],
    choices: [],
  },

  // Shown if the player tries to walk back into the goblin chamber after leaving
  // it. One choice, which routes back out to the deep room via goblin_exit.
  goblin_refuse: {
    id: 'goblin_refuse',
    narrative:
      'You get as far as the mouth of the passage and your body simply stops — the old animal part of you planting its feet before the thinking part has finished the sentence. Back there is a cookfire and a spit and three reasons the floor was sticky. Whatever you settled with them, you settled it once. Going back in is just asking the dark to revise the terms.',
    beats: [
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'No. Whatever\'s back there now, it isn\'t better than it was, and it was barely survivable then. The only direction that doesn\'t cost you is the one you haven\'t walked yet.',
      },
      {
        kind: 'voice',
        speaker: 'YOU',
        text: 'Not going back there. Not for a buckle, not for the meat, not for anything that fire is keeping warm. Forward\'s the only road that doesn\'t already know my face.',
      },
    ],
    choices: [
      { id: 'turn_away', text: 'Turn your back on the fire. Go on into the deep.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_approach: {
    id: 'goblin_approach',
    narrative: 'The chamber is laid out below you. Three goblins, a cookfire, the passage you need. They still haven\'t seen you.',
    beats: [],
    choices: [
      {
        id: 'sneak',
        text: 'Wait for the gap in his circuit, then move.',
        nextNodeId: 'goblin_sneak_mid',
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_spotted' },
      },
      {
        id: 'observe',
        text: 'Stay in the dark and study them a while longer.',
        nextNodeId: 'goblin_observe',
      },
      {
        id: 'ambush',
        text: 'Wait for the pacing one to turn his back. Then hit them before any of them can shout.',
        nextNodeId: 'goblin_ambush_ready',
      },
      {
        id: 'confront',
        text: 'Step into the firelight. All the way. Let them get a good look at what\'s walking toward them.',
        nextNodeId: 'goblin_confront',
      },
    ],
  },

  goblin_observe: {
    id: 'goblin_observe',
    narrative:
      'You hold still and let the chamber teach you. The argument is about the bright thing — a buckle, maybe, or a coin. The pacing one isn\'t guarding anything; he\'s just the kind that can\'t sit. His circuit never changes. Fire, wall, passage, back. And there — coiled at his hip, slapping his thigh on every turn — a whip. The longer you watch, the more the room feels less like a den and more like a clock.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'You want it? You can want it. Wanting\'s free. Having\'s me.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'I found the spot, though. I found the spot where it was. You only reached in first because your arms are — they\'re like a cricket\'s, Nim. Little cricket arms.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Say that again. Go on. Say the cricket thing again and see what it gets you.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Nobody says anything again. Eat. We move at first-dim, same as always, and I\'d like one night we move quiet.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Now you\'re overstaying. Knowing the pattern is worth something. Standing here memorising it past the point of use is worth getting caught. The next turn he makes — that one\'s yours. Don\'t wait for the one after.',
      },
      {
        kind: 'passive',
        skillKey: 'scavenging',
        successInterjection: {
          speaker: 'SCAVENGING',
          text: 'Braided leather, good length. Coiled left-side, single loop over the belt — it\'ll pull free in one move if you come in from the right angle. That\'s worth knowing before you commit.',
        },
        successBonuses: [{
          type: 'size_step_up',
          skillKey: 'scavenging',
          sourceDescription: 'Already clocked the whip — angle, coil, grip',
        }],
      },
      {
        kind: 'passive',
        skillKey: 'hunger',
        failInterjection: {
          speaker: 'HUNGER',
          text: 'That smells edible, actually. The spit. To you, I mean. Not just to them. I\'m only mentioning it. I\'ll stop.',
        },
        failPenalties: [
          { type: 'size_step_down', skillKey: 'dangerSense', sourceDescription: 'Hunger distracted Fiodor' },
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Hunger distracted Fiodor' },
          { type: 'size_step_down', skillKey: 'reputation', sourceDescription: 'Hunger distracted Fiodor' },
        ],
      },
    ],
    choices: [
      { id: 'decide', text: 'You\'ve seen enough.', nextNodeId: 'goblin_approach' },
    ],
  },

  goblin_sneak_mid: {
    id: 'goblin_sneak_mid',
    narrative:
      'You are halfway across — not yet to the rubble pile — when BOLE heaves himself to his feet. Some midnight hunger demand. He reaches for the spit and the fire lurches when he blocks it, throwing a wash of shadow across the near side of the room. You are in the open floor. Stopped.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: "Just — just checking it. I'm just checking. I'm not taking more.",
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'You say that and then you take more.',
      },
      {
        kind: 'passive',
        skillKey: 'dangerSense',
        successInterjection: {
          speaker: 'DANGER SENSE',
          text: "GRIT's eyes went left when BOLE moved. Not to look at BOLE — to look at everything that wasn't BOLE.",
        },
      },
    ],
    choices: [
      {
        id: 'hold',
        text: "Hold. Don't be the thing that moved.",
        nextNodeId: 'goblin_slip',
      },
      {
        id: 'shadow',
        text: 'Lean into the shadow BOLE made when he blocked the fire.',
        nextNodeId: 'goblin_slip',
      },
      {
        id: 'speed_up',
        text: "Close the distance now — BOLE has the room's attention.",
        nextNodeId: 'goblin_spotted',
      },
    ],
  },

  goblin_slip: {
    id: 'goblin_slip',
    narrative:
      'You move when the pacing goblin turns for the wall. Three steps and you fold into the shadow of the rubble pile, one breath held against the stone. The arguing pair never look up. When he turns again you take the last of the open floor in a low, even glide and press yourself into the mouth of the far passage, back flat against cold stone. The fire is three seconds behind you. The chamber is still. None of them have looked up.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Grit. Grit, it\'s warm now. Is it time? It\'s time, isn\'t it. Say it\'s time.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Clear. They don\'t know you\'re here. You could be gone in ten seconds, or you could still use that.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'You\'re past them. Whatever you do next, you do it from a position they don\'t know about. That\'s worth something.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Press on. Leave them to it.', nextNodeId: 'goblin_exit' },
      {
        id: 'poison',
        text: 'Go back. Drop the mushroom in the stew — the fire is right there and they\'ll never know you were behind them.',
        nextNodeId: 'goblin_poison_success',
        check: { skillKey: 'deception', failNodeId: 'goblin_poison_caught' },
        requiresUnlock: 'poison',
      },
    ],
  },

  goblin_poison_success: {
    id: 'goblin_poison_success',
    narrative:
      'You wait for the pacing one to turn, then cross low to the edge of the fire. The corpse-veil crumbles to a grey dust between your fingers and you press it into the underside of the meat, where char hides the colour. Three breaths and it\'s done. You\'re back in the dark before the circuit comes around. Behind you the argument breaks — someone is hungry. They haul the spit from the flame and tear into it, and you walk past the mouth of their chamber while they eat the thing that is going to kill them.',
    beats: [
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        anim: 'poisonStew',
        text: 'Slow hands. Natural hands. Nothing furtive — furtive is what gets seen. You belonged at that fire for exactly as long as you needed to belong there, and not one breath more. That is the whole art of it.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'See? See, it\'s good. Told you it was good. First proper thing in days and it\'s good, Nim, it\'s — here, you have some, I don\'t even mind, you can have some.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Don\'t stay to watch it work. Watching is for people who want to be remembered. Walk.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It\'s… it tastes off. Bole. Bole, it tastes — why\'s it taste like that? Why\'s your mouth doing that?',
      },
      {
        kind: 'voice',
        speaker: 'HUNGER',
        text: 'It did smell good. I want it on record that some part of me is sorry about the waste. Only some part.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Leave them to it. Press on.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_poison_caught: {
    id: 'goblin_poison_caught',
    narrative:
      'Your hand is in the meat when the pacing goblin\'s circuit comes up short. He sees the grey dust on your fingers before he sees your face, and there is no version of this that reads as anything but exactly what it is. He shrieks — not fear, outrage — and the other two are already up. You are crouched at their fire with your hand in their dinner and nowhere good to be.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'HANDS. Hands in the meat — there\'s hands in the meat! GRIT! It\'s putting something in the—',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'I see it. Don\'t shout. Cut it off from the passage and don\'t let it stand up.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'No lie covers this. Don\'t reach for one — a bad lie now just buys them a reason. The only thing left to sell is distance.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Caught with your hand in it. You know this exact flavour of caught. Move before the shape of it finishes forming around you.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Up. Now. Push off the fire-stones and run — the passage is past the small one, and the small one is slow.',
      },
    ],
    choices: [
      {
        id: 'bolt',
        text: 'Kick the fire at them and bolt.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_run_cornered' },
      },
    ],
  },

  goblin_spotted: {
    id: 'goblin_spotted',
    narrative:
      'Your weight comes down on a shard of tin you never saw — the dead angle had a cost the map left out. The sound is small. It is enough. The pacing goblin\'s head snaps around and three pairs of eyes find you at once. The argument dies. The bright thing drops, forgotten. Somewhere a hand closes on a blade.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'There. By the rubble. Knew it — told you the dark was wrong, told you both. On your feet.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'How long\'s it been there? How LONG — it\'s been watching us eat, Grit, it\'s been sitting in the black watching us—',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'I felt it go wrong half a second before it did. Too late to be useful. Forget that. Move now — decide while you\'re moving, not before. Standing still is the only wrong answer left.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'This is the part you know. The cold drop behind the ribs. You\'ve stood exactly here before, in a worse room than this one. You walked out of that room. Remember that you walked out.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Three. You\'ve handled three. Don\'t think about three. Think about the passage behind them, and think about your legs, and nothing else.',
      },
    ],
    choices: [
      {
        id: 'bolt',
        text: 'Bolt for the passage and outrun them.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_run_cornered' },
      },
    ],
  },

  goblin_escaped: {
    id: 'goblin_escaped',
    narrative:
      'You break for the gap before they\'ve thought to close it. A goblin lunges and finds the place you just left; tin and bone scatter under your boots. Then you\'re in the passage and running, the firelight shrinking behind you, the shrieking thinning out as the dark drinks the sound. They don\'t follow far. Goblins never do — the tunnels past their own ground frighten them as much as they frighten anyone.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Run, then! Run, you long pale thing — the deep\'ll have you! It has everyone! It\'ll have YOU!',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Let it go. Past the third marker isn\'t ours and you know it isn\'t. Back. Both of you, back to the fire. Now.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'That\'s enough. Slow down before you put yourself into a wall. The lungs are allowed to hate me later.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'They\'ve stopped. Listen — no feet behind us. You\'re clear. This time, and only because they let you be.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Catch your breath, then go on.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_cornered: {
    id: 'goblin_cornered',
    narrative:
      'The gap closes. Three of them, blades out, cutting off every angle — the passage, the fire, the rubble pile. They move like they\'ve done this before, patient and unhurried. You\'ve seen this shape from the other side. The fire is at your back.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'No more running. You picked the wrong fire, crawl-thing. Should\'ve stayed in your dark.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Slow, Grit. Do it slow. It watched us eat. Let it watch a while too.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Here it is, then. The bill for the body, come due in a goblin warren of all the stupid places.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Then we don\'t run. We plant. We set our weight and we make ourselves the most expensive thing in this room.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'You are not dying down here over a shiny scrap of tin and somebody else\'s grin. Make them regret reaching for the blade. Make it the worst decision the little one ever made.',
      },
    ],
    choices: [
      { id: 'last_stand', text: 'Set your back to the fire and make them pay for it.', nextNodeId: 'goblin_fight3_r1' },
    ],
  },

  goblin_run_cornered: {
    id: 'goblin_run_cornered',
    narrative:
      'Your legs don\'t have it. The old knee buckles two strides in and the gap closes ahead of you. A goblin slides between you and the passage, blade held low, grinning the way small things grin when they\'ve suddenly become the larger problem. The other two fan out behind. The fire is at your back now. There is no more running to do.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'The knee. It\'s always the knee with the old ones. Don\'t feel bad about it — wasn\'t your knee that picked this fight.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Does it — does it have to, though? Grit. It stopped. Look at it, it stopped running, it\'s just sitting there breathing.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Yes it has to. Sit down, Bole. It came to OUR fire. Sit down and let Grit work.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Here it is, then. The bill for the body, come due in a goblin warren of all the stupid places.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Then we don\'t run. We plant. We set our weight and we make ourselves the most expensive thing in this room.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'You are not dying down here over a shiny scrap of tin and somebody else\'s grin. Make them regret reaching for the blade. Make it the worst decision the little one ever made.',
      },
    ],
    choices: [
      { id: 'last_stand', text: 'Set your back to the fire and make them pay for it.', nextNodeId: 'goblin_fight3_r1' },
    ],
  },

  // ── Three-goblin fight ───────────────────────────────────────────────────────
  // Reached from goblin_cornered / goblin_run_cornered (and terrify/ambush
  // failures that route through them). GRIT is alive and holds the whip, so
  // there is no whip option here. Fiodor is fully outnumbered: the fight opens
  // with a stress hit (size_step_down) and every failed round stacks another,
  // shrinking the dice until — if it goes badly enough — he dies.
  //
  //   r1        → opening. stress hit #1. one check + (mushroom).
  //     pass    → r2        (momentum)
  //     fail    → r2_hurt   (on the back foot, stress hit #2)
  //   r2        → the turn. press / outwit / (mushroom).
  //     pass    → goblin_fight_won  or  goblin_fight_won_wit
  //     fail    → r3_hurt   (one slip from death, stress hit)
  //   r2_hurt   → desperate. dig in / (mushroom).
  //     pass    → goblin_fight_won  (clawed it back)
  //     fail    → goblin_death
  //   r3_hurt   → last effort. one check + (mushroom).
  //     pass    → goblin_fight_won
  //     fail    → goblin_death

  goblin_fight3_r1: {
    id: 'goblin_fight3_r1',
    narrative:
      'No more talk. The big one comes first — of course he does, hunger makes him brave — and the other two slide wide to take your flanks. You give ground you can\'t afford to give just to keep all three in front of you. The fire spits at your heels. Three blades. One of you.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'I\'m sorry. I am. I don\'t want to but I\'m so — you smell like food and I\'m so hungry, I\'m sorry—',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Three angles, and you can only watch two. Whichever way you face, something is at your back. That\'s the whole problem of three. It doesn\'t go away — you just choose which version of it to suffer.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Outnumbered three to one' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'Then make the choosing cost them. You don\'t have to win every exchange. You have to be the most expensive meal this fire has ever tried to cook.',
      },
    ],
    choices: [
      {
        id: 'crowd',
        text: 'Get inside the big one\'s reach before the other two can set.',
        nextNodeId: 'goblin_fight3_r2',
        check: { skillKey: 'endurance', failNodeId: 'goblin_fight3_r2_hurt' },
      },
      {
        id: 'give_ground',
        text: 'Keep all three in front of you. Read the room, not the blades.',
        nextNodeId: 'goblin_fight3_r2',
        check: { skillKey: 'wayfinding', failNodeId: 'goblin_fight3_r2_hurt' },
      },
      {
        id: 'mushroom',
        text: 'The corpse-veil. Hurl it into their faces and see what it does.',
        nextNodeId: 'goblin_mushroom3',
        requiresUnlock: 'poison',
      },
      {
        id: 'brace',
        text: 'Back to the wall. Force them to funnel in — the fire covers the left angle.',
        nextNodeId: 'goblin_fight_brace',
      },
      {
        id: 'flee_r1',
        text: 'The passage is still open. Bolt before they close it.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_fight3_r2_hurt' },
      },
      {
        id: 'talk',
        text: 'WAIT—',
        nextNodeId: 'goblin_fight_talk_open',
      },
    ],
  },

  goblin_fight3_r2: {
    id: 'goblin_fight3_r2',
    narrative:
      'The opening works. The big one overcommits and you turn him into a wall between you and the other two — for a breath, the fight is one-on-one instead of three-on-one. That breath is everything. Now you spend it.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Bole, move — you\'re in the way, you great soft — Grit, it\'s using him, it\'s using Bole as a—',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'You have him stacked. The other two have to come around or come through, and either way they have to come slow. This is the best the math will ever look. Don\'t admire it. Use it.',
      },
      {
        kind: 'voice',
        speaker: 'DUNGEON LORE',
        text: 'The fire. The rubble pile. The low ceiling over the passage mouth. A room is never just a room — it is a list of things that can be turned against the people standing in it. You read this one on the way in. Read it again, faster.',
      },
    ],
    choices: [
      {
        id: 'press',
        text: 'Press the advantage. Put the big one down and turn on the rest.',
        nextNodeId: 'goblin_fight_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_fight3_r3_hurt' },
      },
      {
        id: 'outwit',
        text: 'Don\'t out-fight them. Out-think them — use the room.',
        nextNodeId: 'goblin_fight_won_wit',
        check: { skillKey: 'wayfinding', failNodeId: 'goblin_fight3_r3_hurt' },
      },
      {
        id: 'mushroom',
        text: 'End the question. Throw the corpse-veil.',
        nextNodeId: 'goblin_mushroom3',
        requiresUnlock: 'poison',
      },
      {
        id: 'spit',
        text: 'Grab the cooking spit. Something in your hand that isn\'t empty.',
        nextNodeId: 'goblin_fight_spit',
      },
      {
        id: 'feign',
        text: 'Let the body sell it — show them more damage than there is.',
        nextNodeId: 'goblin_fight_feign',
      },
      {
        id: 'flee_r2',
        text: 'The big one\'s between you and them. Put him there properly and go.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_fight3_r3_hurt' },
      },
    ],
  },

  goblin_fight3_r2_hurt: {
    id: 'goblin_fight3_r2_hurt',
    narrative:
      'It goes wrong fast. A blade you didn\'t track opens a hot line across your forearm and the big one\'s shoulder catches you in the chest and folds you back toward the fire. You get a boot under you before you go down, but only just. They smell it now — the turn. You can see them deciding you\'re already dead.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'There it is. There it IS — it\'s slowing, Grit, it\'s done, finish the long pale thing, finish it—',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'That one\'s going to scar. If there\'s a later for it to scar in. The body is running out of the thing it runs on — you can feel the floor of it now, close under your feet.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Bleeding, outnumbered, fading' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'You still have the grey fungus. The old delvers swore the deep-things won\'t touch what\'s touched a corpse. Mad. Desperate. But you\'re a step from the floor and the mad thing is the only thing that hasn\'t been tried.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'Not like this. Not on a goblin\'s fire over a buckle. Get up. One more. Make the little one wrong about you.',
      },
    ],
    choices: [
      {
        id: 'dig_in',
        text: 'Dig in. Refuse to be right about. One more exchange.',
        nextNodeId: 'goblin_fight_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_death' },
      },
      {
        id: 'mushroom',
        text: 'The corpse-veil. Nothing left to lose — throw it.',
        nextNodeId: 'goblin_mushroom3',
        requiresUnlock: 'poison',
      },
      {
        id: 'flee_r2_hurt',
        text: 'Run. Whatever it costs.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_fight3_r3_hurt' },
      },
    ],
  },

  goblin_fight3_r3_hurt: {
    id: 'goblin_fight3_r3_hurt',
    narrative:
      'You had them and then you didn\'t. The opening you bought closed on your own arm; the big one shrugged off the blow that should have ended him and now all three are on you at once, and the fire is so close at your back you can feel it through your coat. One more wrong thing and there won\'t be a you to do the next thing.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Almost. You almost had it. For what it\'s worth — and it\'s worth nothing down here — you fought better than most that end up at this fire.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Everything hurts and the parts that don\'t hurt are the parts you should worry about. This is the bottom of it. There is no round after this one — there is a win, or there is the floor.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'One exchange from the floor' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'The fungus. Still. I will keep saying it until you do it or die not having. The grey on the wall grows where things died and stays where things fear to. Throw it.',
      },
    ],
    choices: [
      {
        id: 'last_effort',
        text: 'Everything. Right now. Into the next swing.',
        nextNodeId: 'goblin_fight_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_death' },
      },
      {
        id: 'mushroom',
        text: 'Listen to the mad voice. Throw the corpse-veil.',
        nextNodeId: 'goblin_mushroom3',
        requiresUnlock: 'poison',
      },
      {
        id: 'flee_r3_hurt',
        text: 'Break. Now. Whatever\'s left — spend it running.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_death' },
      },
    ],
  },

  // ── Combat maneuvers, desperation moves, and the long-shot dialogue path ────
  // Non-check setup moves (wall brace, weapon of opportunity), hidden-bad
  // choices (feigning, wrong-target appeals), flee options throughout, and a
  // mid-fight conversation path that is very unlikely to work but available.
  // All re-enter the main sequence at their appropriate hurt/okay nodes.

  goblin_fight_brace: {
    id: 'goblin_fight_brace',
    narrative:
      'You back to the wall and let them come. The fire covers the left approach; the rubble pile covers the right. There are exactly two angles now, and neither of them is easy. You are three feet of very specific problem, and nothing in this room can get behind you. It doesn\'t fix the numbers. It fixes the shape of them, which is the only fix on offer.',
    beats: [
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Better. They\'re paying rent now. Every inch costs them — hold this, make them earn it, don\'t give a foot back without making the taking expensive.',
        bonuses: [
          { type: 'size_step_up', skillKey: 'endurance', sourceDescription: 'Wall position — only two can reach you at once' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Fan wide. Around the fire — left and right, it can\'t hold two angles at once. Keep moving.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'He split them to come wide. The small one\'s going left, behind the fire — he thinks that\'s when he has the angle. He\'s wrong. Show him before he stops believing it.',
      },
    ],
    choices: [
      {
        id: 'press',
        text: 'They\'re split. Get inside the small one\'s reach before they reset.',
        nextNodeId: 'goblin_fight3_r2',
        check: { skillKey: 'endurance', failNodeId: 'goblin_fight3_r2_hurt' },
      },
      {
        id: 'read',
        text: 'Watch where they\'re going to be, not where they are.',
        nextNodeId: 'goblin_fight3_r2',
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_fight3_r2_hurt' },
      },
    ],
  },

  goblin_fight_spit: {
    id: 'goblin_fight_spit',
    narrative:
      'You grab the cooking spit one-handed — the meat is still on it, still hot — and the fat pops against your palm and you hold it anyway. They pull back from the arm of fire. You have reach now, and the specific reek of a bad decision that is paying off, and a hand that is going to remember this for weeks.',
    beats: [
      {
        kind: 'voice',
        speaker: 'HUNGER',
        text: 'That smells like protein. I\'m aware of what you\'re doing with it. I\'m only noting the smell.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Nim — it\'s got the spit. It took the spit off the fire. That\'s our spit, Nim.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'Let them look at it. They can see what\'s at the end of it and where it just came from. You bought reach and the suggestion of what you\'d do with reach. Hold it level. Mean it.',
        bonuses: [
          { type: 'size_step_up', skillKey: 'spite', sourceDescription: 'Burning brand — reach, heat, and the clear implication' },
        ],
        penalties: [
          { type: 'add_stress_die', skillKey: 'endurance', sourceDescription: 'The burn is real — the hand will collect on this later' },
        ],
      },
    ],
    choices: [
      {
        id: 'drive',
        text: 'Drive them back with it. Keep them at the end of it and pick your moment.',
        nextNodeId: 'goblin_fight_won',
        check: { skillKey: 'spite', failNodeId: 'goblin_fight3_r3_hurt' },
      },
      {
        id: 'use_room',
        text: 'The fire, the rubble, the low ceiling. All of it — use the room.',
        nextNodeId: 'goblin_fight_won_wit',
        check: { skillKey: 'dungeonLore', failNodeId: 'goblin_fight3_r3_hurt' },
      },
    ],
  },

  goblin_fight_feign: {
    id: 'goblin_fight_feign',
    narrative:
      'You let the leg go — just for a half-second, just enough to sell it — and one of them actually pulls up. Then NIM makes a sound. Short and flat, the sound a door makes when it closes on purpose.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Oh. Oh, it\'s clever. The leg. Grit — look at the leg, look at how deliberate that was. That\'s a trap, that\'s the trap-shape. I hate it. I\'ve seen it twice and I still hate it. In — before the leg gets better.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'In.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'NIM read it faster than you threw it. In a fight like this there\'s no sell — they\'re not deciding what to believe, they\'re deciding when to move. You handed him the exact shape of desperation and he filed it.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'NIM clocked the feign and they closed before you recovered' },
        ],
      },
    ],
    choices: [
      {
        id: 'back_to_it',
        text: 'No more tricks. Set your weight.',
        nextNodeId: 'goblin_fight3_r2_hurt',
      },
    ],
  },

  goblin_fight_talk_open: {
    id: 'goblin_fight_talk_open',
    narrative:
      'You shout WAIT — just the word, just the shape of a stop — and something in the chamber holds. One second. The big one flinches. GRIT stops mid-step. You have the length of one breath before the moment closes and they decide it was nothing.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: '...It\'s talking. While it\'s bleeding.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Fast. Say it fast.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Nim, it stopped. Maybe it doesn\'t want to — maybe we could just—',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It\'s buying time. Every word is a second it\'s not bleeding. Don\'t.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'GRIT held his own hand. That is the only miracle available in this room. He\'s the one who can change the math — NIM is already gone, BOLE follows whoever decides. Speak to the one who decides. One thing, flat, about the cost.',
      },
    ],
    choices: [
      {
        id: 'cost',
        text: '(to GRIT) "You know how this ends if I have to finish it. You\'ve been doing this long enough to run that count. How many of you walk out?"',
        nextNodeId: 'goblin_fight_talk_close',
      },
      {
        id: 'mercy',
        text: '(to all three) "Nobody has to die here. Walk away — right now, all of you."',
        nextNodeId: 'goblin_fight_talk_miss',
      },
      {
        id: 'bole',
        text: '(to BOLE) "BOLE — just step back. You don\'t have to be in this."',
        nextNodeId: 'goblin_fight_bole_appeal',
      },
    ],
  },

  goblin_fight_talk_miss: {
    id: 'goblin_fight_talk_miss',
    narrative:
      'The moment closes. You watch GRIT\'s face do something small and final, and then they\'re moving again.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'There. The mercy voice. Every big thing tries the mercy voice at the end. You know what the mercy voice is, Bole? It\'s the voice of something hoping we\'re frightened. We\'re not frightened. Go.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You spoke to the room. A room that doesn\'t have to decide doesn\'t. NIM named the play before you finished it. The breath you spent is gone, and GRIT used it to advance.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'NIM named the mercy play — the room heard it and stopped deciding' },
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Gave them a breath — they used it to advance' },
        ],
      },
    ],
    choices: [
      {
        id: 'back_to_it',
        text: 'Back to it.',
        nextNodeId: 'goblin_fight3_r2_hurt',
      },
    ],
  },

  goblin_fight_talk_close: {
    id: 'goblin_fight_talk_close',
    narrative:
      'GRIT looks at you. Not the way he did when you were a stranger at the fire\'s edge — this is the other look, the calculator look, running the numbers on whether a thing still upright and talking mid-fight costs more to put down than to let through.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'The last thing that talked to me mid-fight, I opened up anyway. Didn\'t help it.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Grit—',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'One more word. A real one.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'He\'s still holding his hand back. The market is terrible — you\'re bleeding, breathless, and he can see the math as clearly as you can. But there\'s a reason to wonder. Sell him the cost. Not the mercy. The cost. One flat specific thing, and then let the silence do the last piece.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Mid-fight — the context is terrible and GRIT knows exactly what it is' },
        ],
      },
    ],
    choices: [
      {
        id: 'say_it',
        text: 'Say it. Flat. No flourish.',
        nextNodeId: 'goblin_threat_success',
        check: { skillKey: 'deception', failNodeId: 'goblin_fight3_r2_hurt' },
      },
    ],
  },

  goblin_fight_bole_appeal: {
    id: 'goblin_fight_bole_appeal',
    narrative:
      'BOLE\'s eyes go soft — and then NIM\'s hand clamps on his shoulder and BOLE goes blank in the way large things go blank when they\'ve handed the thinking over to someone else.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'No. BOLE — look at me, not at it. Look at ME. It killed Grit and now it wants to use your face against you. Eyes on me. Stay.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...yeah. Yeah, Nim. Sorry. I would\'ve.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'BOLE would have. But BOLE doesn\'t hold the decision — NIM stepped in and closed the door and you spent the pause on the wrong goblin. GRIT watched you aim at the wrong target. He\'ll spend that knowledge.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Wrong target — NIM shut it down and GRIT filed the attempt' },
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Spent the pause in the wrong direction' },
        ],
      },
    ],
    choices: [
      {
        id: 'back_to_grit',
        text: 'Too late for BOLE. Back to GRIT — try to finish what you started.',
        nextNodeId: 'goblin_fight3_r2_hurt',
      },
    ],
  },

  goblin_fight_won_wit: {
    id: 'goblin_fight_won_wit',
    narrative:
      'You don\'t beat them. You beat the room. A shoulder into the rubble pile brings a slab of it down across the fire in a gout of sparks and choking ash, and for three heartbeats none of them can see a thing. Three heartbeats is a doorway. You\'re through the passage mouth and gone before the dust settles, their shouting boxed up behind a wall of grit and smoke. You didn\'t win the fight. You ended it.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Where — WHERE — Grit, the smoke, I can\'t — don\'t let it through, don\'t you let it—',
      },
      {
        kind: 'voice',
        speaker: 'DUNGEON LORE',
        text: 'A loose pile, a low fire, a narrow exit. The room was always going to do that if you asked it to. The trick is being the one who asks before anyone thinks to stop you.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'No feet behind us. The dust did the work the legs couldn\'t. Slow down. You\'re clear — and you didn\'t have to leave three names on that floor to do it.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Don\'t look back. Press on.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_mushroom3: {
    id: 'goblin_mushroom3',
    narrative:
      'You tear the grey handful from your coat and hurl it underhand into the firelight between you. It bursts on impact — a soft, awful pop and a cloud of pale spores and the smell of it, the smell of every dead thing the corpse-veil ever grew out of, rolling across the chamber thick as a held breath.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'That — Grit, that\'s the dead-smell, that\'s the smell from the deep rooms, the smell we don\'t — we don\'t GO where that smell is—',
      },
      // The throw always buys a beat of confusion, roll or no roll.
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'I TOLD you. Look at them. The body remembers what the mind pretends it forgot — every one of them was whelped on the rule: where it smells like that, you don\'t go. You just rewrote the room.',
        bonuses: [
          { type: 'size_step_up', skillKey: 'endurance', sourceDescription: 'Corpse-veil broke the room\'s nerve' },
        ],
      },
      // Superstition decides how far the dread runs. Pass: it grips them and you
      // strike clean. Fail: it just baffles them — still a gift, but a smaller,
      // stranger one.
      {
        kind: 'passive',
        skillKey: 'superstition',
        successInterjection: {
          speaker: 'SUPERSTITION',
          text: 'It has them. All three frozen at the edge of the smell like dogs at a threshold they\'ve been beaten away from. They will not step into it. So you will. Now — while the old fear is wearing their faces.',
        },
        successBonuses: [
          { type: 'ignore_stress', skillKey: 'endurance', sourceDescription: 'The goblins\' own dread holds them still' },
        ],
        failInterjection: {
          speaker: 'HUNGER',
          text: 'He\'s… eating it. The big one. There\'s a face full of corpse-spore and his tongue\'s out. The other two are just staring at him. Nobody is fighting anymore. Nobody knows what this is. Honestly? Neither do I. Take it.',
        },
      },
    ],
    choices: [
      {
        id: 'strike',
        text: 'Into the gap the smell opened. End it.',
        nextNodeId: 'goblin_fight_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_death' },
      },
    ],
  },

  // ── Ambush path ─────────────────────────────────────────────────────────────

  goblin_ambush_ready: {
    id: 'goblin_ambush_ready',
    narrative:
      'You\'ve been watching long enough. The pacing one is at the far end of his circuit, back to you for four seconds, maybe five. The arguing pair haven\'t looked up in two minutes. You know where all three of them are. This is the moment — not a better one, not a cleaner one. This one.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '—so I says to it, I says, that\'s not a rock, that\'s my dinner. And it WAS a rock. Whole time. I was so happy and it was a rock.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'That\'s not funny. That was never funny, Bole, you\'ve told it a hundred times—',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Three. You\'ve handled three. Don\'t think about three. Think about the first one.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'The hesitation is what gets you killed. You learned that. Remember where you learned that.',
      },
      {
        kind: 'passive',
        skillKey: 'hunger',
        failInterjection: {
          speaker: 'HUNGER',
          text: 'That thing on their spit. Still there. Still warm. I\'m just noting it.',
        },
        failPenalties: [
          { type: 'size_step_down', skillKey: 'dangerSense', sourceDescription: 'Hunger distracted Fiodor' },
        ],
      },
    ],
    choices: [
      {
        id: 'strike',
        text: 'Go.',
        nextNodeId: 'goblin_ambush_success',
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_ambush_fail' },
      },
      {
        id: 'wait',
        text: 'Wait. Not yet.',
        nextNodeId: 'goblin_approach',
      },
    ],
  },

  goblin_ambush_success: {
    id: 'goblin_ambush_success',
    narrative:
      'You move and the pacing one goes down before he finishes his turn — he didn\'t hear you coming, which is the only mercy in it. The other two spin toward the sound and find you already standing over him. Two left. The odds improved the moment you stepped into the room. They know it too.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Grit? Grit. Get up. Why aren\'t you — GET UP, you\'re the one who gets up, that\'s the whole—',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'It killed Grit. Nim. Nim, it killed Grit. He didn\'t even. Oh. Oh no. No no no—',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Called it. Don\'t stop — the other two are reading you right now, deciding whether to charge or scatter. Give them the answer before they finish the question.',
      },
      {
        kind: 'passive',
        skillKey: 'scavenging',
        // If the player scouted the whip in goblin_observe, the grab is certain.
        guaranteedBy: 'scavenging',
        successInterjection: {
          speaker: 'SCAVENGING',
          text: 'The dead one\'s got a whip coiled at his belt. Crack it once and they flinch — buys you a step whether you\'re going through them or past them. Take it.',
        },
        successBonuses: [
          { type: 'size_step_up', skillKey: 'spite', sourceDescription: 'Goblin\'s whip — one crack, they flinch' },
          { type: 'unlock_choice', unlockKey: 'whip', sourceDescription: 'Grabbed the whip' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Two. Think about the next one. The first one\'s already done.',
      },
    ],
    choices: [
      {
        id: 'fight',
        text: 'Finish it.',
        nextNodeId: 'goblin_fight_two_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_ambush_overextended' },
        suppressedBy: 'whip',
      },
      {
        id: 'fight_whip',
        text: 'Use the whip. Keep them off you, then close the distance.',
        nextNodeId: 'goblin_fight_two_won_whip',
        check: { skillKey: 'spite', failNodeId: 'goblin_cornered_two' },
        requiresUnlock: 'whip',
      },
      {
        id: 'run',
        text: 'They\'re still deciding. Move now — through the gap, before they close it.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_cornered_two' },
      },
    ],
  },

  goblin_ambush_fail: {
    id: 'goblin_ambush_fail',
    narrative:
      'He moved. Two feet to the left, a half-second earlier than the circuit said, and when you come in fast he\'s looking right at you. The shout goes up before you reach him. The other two are already on their feet. Three of them, all alert, all between you and the passage.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Knew it. KNEW it. Up — both of you, up, it\'s the crawl-thing, it\'s been on us all night. Whips out. Fan.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'He moved. I didn\'t catch it — that\'s on me. Three of them now, all awake. The math got worse.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Outnumbered 3 to 1' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Pick the smallest one. Always the smallest one first — they go down fastest and the other two flinch when they see it. Buy yourself a second. Use the second.',
      },
    ],
    choices: [
      {
        id: 'fight',
        text: 'Fight through to the passage.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_cornered' },
      },
    ],
  },

  goblin_fight_won: {
    id: 'goblin_fight_won',
    narrative:
      'It takes longer than it should and it is not clean. But when the chamber settles there are three goblins down and you are not. The fire crackles on. The bright thing they were arguing over has rolled under the rubble. You stand in the quiet and remember how to breathe.',
    beats: [
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'There it is. The body held. You can hate me for asking it to later — right now check your hands and keep moving.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Three. And you walked out. Remember that number. It was possible.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Step over them and press on.', nextNodeId: 'goblin_cleared' },
    ],
  },

  goblin_fight_two_won: {
    id: 'goblin_fight_two_won',
    narrative:
      'Two more, after the first. They came in together and it was ugly and close, and at some point it stopped being a fight and became something you just had to outlast. When it ends you are still upright. Barely. The chamber is quiet. Three goblins down, each by a different method, none of them clean.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'The meat was good though. Wasn\'t it. Tell Nim it — tell him I said it was good…',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Different from three. Worse in some ways — they knew what you\'d done, and they came in angry. But the body held that too. File it.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'That\'s going to leave a mark. Worth it. The passage is right there — it was always right there. You just had to earn it twice.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Catch your breath. Then go.', nextNodeId: 'goblin_cleared' },
    ],
  },

  goblin_fight_two_won_whip: {
    id: 'goblin_fight_two_won_whip',
    narrative:
      'The whip keeps them honest. One crack and they back off a step — enough to breathe, to reset, to pick the opening. It\'s still ugly. But you had reach and they didn\'t, and when the chamber goes quiet there are two more down and the whip is still in your hand.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Still… still mine. Pulled it out of the muck. Mine. You can\'t — that\'s the rule…',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'That\'s what a whip is for. Not reach — humiliation. Every crack said the same thing: you can\'t get to me. They believed it long enough for it to be true.',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'That\'s going to leave a mark or two. Worth it. And you\'ve got something to show for it besides the bruises.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Coil the whip and press on.', nextNodeId: 'goblin_cleared' },
    ],
  },

  goblin_ambush_overextended: {
    id: 'goblin_ambush_overextended',
    narrative:
      'You go in hard and the follow-through is wrong — the blade catches on something it shouldn\'t, bone or belt or the cheap iron of GRIT\'s armour, and for one terrible half-second you are leaning forward with your weight fully committed and your arm locked out and no way to recover it. By the time you wrench free, NIM is already inside your guard. BOLE is three steps behind him, grief and hunger wearing the same face. The opening you bought just cost you everything you got from it.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Stuck. It\'s stuck — BOLE, it\'s stuck, get in, get IN—',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'You overstretched. The body did what you asked and then it asked back, and the answer was no. Pull it together. You\'re still up. That\'s the only number that matters right now.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Overextended — the follow-through went wrong' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'The last time you got this wrong someone else pulled you out of it. Nobody is going to pull you out of this. So get your weight back under you and finish what you started.',
      },
    ],
    choices: [
      { id: 'regroup', text: 'Get your weight back. Face them.', nextNodeId: 'goblin_cornered_two' },
    ],
  },

  // ── Two-goblin fight ─────────────────────────────────────────────────────────
  // Reached when the ambush kill doesn't close it out. Only NIM and BOLE remain
  // — but they watched you put GRIT down, and NIM adapts. Shorter than the
  // three-goblin fight (one stress hit, two rounds), and more survivable: Fiodor
  // has already proven himself. NIM anticipates cleverness, so there's no
  // out-think route here — escalation (the whip) is what he didn't see coming.
  //
  //   cornered_two → stand / (whip) / (mushroom). stress hit #1.
  //     pass       → goblin_fight_two_won  or  goblin_fight_two_won_whip
  //     fail       → r2_hurt   (stress hit #2)
  //   r2_hurt      → last effort / (mushroom).
  //     pass       → goblin_fight_two_won
  //     fail       → goblin_death

  goblin_cornered_two: {
    id: 'goblin_cornered_two',
    narrative:
      'You don\'t make it. Two of them, not three — but they watched you put the first one down and they\'ve adjusted. No grinning. No posturing. They spread wide and come in low, blades out, making themselves expensive. This is a fair fight by dungeon standards, which means it\'s still bad.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'You killed him. You killed Grit and you\'re going to stand there breathing about it. No. No, you\'re not. Bole — with me. WITH me.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'I\'m with you. I\'m with you, Nim. I don\'t — I don\'t want to but I\'m with you.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Two, not three — but the small one\'s gone careful. He\'s not coming at you, he\'s coming at the spaces you keep leaving. Mind those spaces. He\'s already in them in his head.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Outnumbered, and the small one learns' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'They saw what you did to the first one and they\'re still here. Respect that. Then make them regret it.',
      },
    ],
    choices: [
      {
        id: 'stand',
        text: 'Stop moving. Make them come to you.',
        nextNodeId: 'goblin_fight_two_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_fight2_r2_hurt' },
      },
      {
        id: 'whip',
        text: 'Crack the whip. Keep them at the end of it and pick them apart.',
        nextNodeId: 'goblin_fight_two_won_whip',
        check: { skillKey: 'spite', failNodeId: 'goblin_fight2_r2_hurt' },
        requiresUnlock: 'whip',
      },
      {
        id: 'mushroom',
        text: 'The corpse-veil. Throw it and break whatever they think they know.',
        nextNodeId: 'goblin_mushroom2',
        requiresUnlock: 'poison',
      },
      {
        id: 'flee',
        text: 'Break for the passage. They\'re angry, not careful.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_fight2_r2_hurt' },
      },
      {
        id: 'bole',
        text: 'BOLE.',
        nextNodeId: 'goblin_fight_bole_plea',
      },
    ],
  },

  goblin_fight2_r2_hurt: {
    id: 'goblin_fight2_r2_hurt',
    narrative:
      'The small one was right about the spaces. He slips into one you didn\'t mean to leave and his blade finds you low on the side — not deep, but enough, a bright wrong heat under the ribs. The big one is sobbing and swinging at the same time, which somehow makes him worse, not better. You\'re still up. You\'re not sure how much that\'s worth anymore.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'For Grit. For Grit, you hear me? You don\'t get to do that and just WALK—',
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Under the ribs. That\'s a careful wound — he meant it exactly there. The body\'s got one good answer left in it, maybe. Not two. Spend it right.',
        penalties: [
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Cut low, one answer left' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'The grey fungus, if you still carry it. Now would be the hour the old delvers meant when they said keep it for the hour you stop being able to count on your hands.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'Two of them and you put down the one who scared you. Don\'t you dare fall to the leftovers. One more. Make it the one that counts.',
      },
    ],
    choices: [
      {
        id: 'last_effort',
        text: 'The last good answer. All of it, right now.',
        nextNodeId: 'goblin_fight_two_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_death' },
      },
      {
        id: 'mushroom',
        text: 'The corpse-veil. The hour the old ones meant. Throw it.',
        nextNodeId: 'goblin_mushroom2',
        requiresUnlock: 'poison',
      },
    ],
  },

  goblin_mushroom2: {
    id: 'goblin_mushroom2',
    narrative:
      'You wrench the grey handful loose and throw it low, into the space between the two of them. It bursts grey and soft and the dead-smell unrolls across the firelight — the smell of the deep rooms, the rooms even goblins won\'t den in. The big one makes a sound like a kicked dog.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'NO — no, not that, Nim, that\'s the wrong-smell, that\'s the don\'t-go smell, why does it HAVE the—?',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'The big one\'s already gone — look at him, all that meat and he\'s a whelp again backing off the smell. The smart one\'s the question. He\'s smart enough to be more afraid of you than of an old story. We\'ll see which fear he listens to.',
        bonuses: [
          { type: 'size_step_up', skillKey: 'endurance', sourceDescription: 'Corpse-veil unmade the big one\'s nerve' },
        ],
      },
      {
        kind: 'passive',
        skillKey: 'superstition',
        successInterjection: {
          speaker: 'SUPERSTITION',
          text: 'There. Even the smart one. He knows the smell with the back of his neck, not the front of his head, and the back of his neck wins. They\'re both frozen at the edge of it. Walk in. They won\'t.',
        },
        successBonuses: [
          { type: 'ignore_stress', skillKey: 'endurance', sourceDescription: 'Even NIM won\'t cross the dead-smell' },
        ],
        failInterjection: {
          speaker: 'DECEPTION',
          text: 'The small one\'s not buying it. You can see him do the sum — old smell, or the thing that killed Grit — and land on you. But the big one bought it for both of them, and a partner who\'s backing away from the air is a partner who isn\'t guarding a flank. That\'ll do. That\'ll have to.',
        },
      },
    ],
    choices: [
      {
        id: 'strike',
        text: 'The big one\'s out of it. Take the small one while he\'s alone.',
        nextNodeId: 'goblin_fight_two_won',
        check: { skillKey: 'endurance', failNodeId: 'goblin_death' },
      },
    ],
  },

  goblin_fight_bole_plea: {
    id: 'goblin_fight_bole_plea',
    narrative:
      'You say his name into the fight — just the name, no sentence attached — and BOLE stops. Not all the way. He\'s still holding what\'s in his hand. But you\'ve found a thread, and for one half-second NIM doesn\'t have it.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'BOLE. BOLE, don\'t you—',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...it knows my name.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'I KNOW your name! It doesn\'t — BOLE—',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Grit knew my name. And Grit\'s gone, Nim. It\'s the thing that — it knew Grit\'s name too. And it\'s still standing. Maybe we should hear it.',
      },
      {
        kind: 'voice',
        speaker: 'REPUTATION',
        text: 'GRIT held this room and GRIT is gone and BOLE just did that math without your help. What\'s left is him and NIM and a thing that put GRIT down and kept going. That registers differently when the one who held the room can\'t hold it anymore.',
      },
    ],
    choices: [
      {
        id: 'price',
        text: '"Name something you need that doesn\'t have to be this. Name a price."',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'deception', failNodeId: 'goblin_fight2_r2_hurt' },
      },
      {
        id: 'silence',
        text: 'Say nothing more. Let the name sit on him.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'reputation', failNodeId: 'goblin_fight2_r2_hurt' },
      },
    ],
  },

  // ── Death ────────────────────────────────────────────────────────────────────
  // The floor. Shared terminal for every fight that runs out of rounds.
  // Narratively final — the voices get the last word and the big one,
  // matter-of-fact, gets the last act. Mechanically it loops back to the start
  // of the sequence; there is no checkpoint to scum.

  goblin_death: {
    id: 'goblin_death',
    narrative:
      'The body finds the floor before you decide to put it there. Stone, cold through the coat, and the fire too bright and sideways now, and the small one\'s voice somewhere above going on and on about a name you took from him. You are aware, distantly, that the going-on stops mattering. The chamber tilts. The light pulls back to a coin, then a pinhole.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'That\'s it. That\'s it, that\'s for Grit, that\'s — Bole, it\'s down, it\'s actually — we did it, we did the thing, we—',
      },
      {
        kind: 'voice',
        speaker: 'THE DEEP',
        text: 'Down here you were only ever a warm thing that walked. The dark has been patient with you the way it is patient with everything. It is not angry. It is not anything. It simply closes, the way water closes, and forgets the shape you made.',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'I told you to throw the fungus. Or I didn\'t. It doesn\'t matter now which of us is remembering it true. That\'s the thing about being right too late — nobody is left to keep the score.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Is it — is it food now? It can be food now, can\'t it? I\'m so hungry, Nim. I\'ve been so hungry the whole time. It doesn\'t have a name anymore. It\'s just the meat.',
      },
    ],
    choices: [
      { id: 'restart', text: '—', nextNodeId: 'goblin_start', resetsSequence: true },
    ],
  },

  // ── Confrontation path ───────────────────────────────────────────────────────
  // Step into the firelight and engage them openly. Once revealed there's no
  // backing into the dark — every choice in goblin_confront is a committed
  // path. Four approaches: wordless presence (Reputation → goblin_terrify_*),
  // spoken menace (→ goblin_talk_open), mushroom bribe (→ goblin_bribe_open),
  // or turning them against each other (→ goblin_divide_open).
  //
  // Conversation angles that branch from goblin_confront:
  //   - silent terror, spoken threat, bribe, turn-them-against-each-other (divide)
  //   - ally to be put to use (goblin_ally_*)
  //   - claim to be a different kind of goblin (goblin_species_*)

  goblin_confront: {
    id: 'goblin_confront',
    narrative:
      'You step out of the dark and into the firelight — all the way, no hesitation, the way you walk toward a thing you mean to be the worst part of. The pacing one stops mid-circuit. The arguing pair look up. The bright thing drops, forgotten. For one held breath nobody in the chamber knows what happens next, you included. They\'re looking at you now. Whatever you do with the next three seconds, you do it in the light, and you don\'t get to take it back.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Hold. Nobody move — Nim, hand off the buckle. You. Long one. What in the dark are you, walking up to a fire like you own the dark it came out of?',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'It\'s big, Grit. It\'s so big and it\'s not running. Things run. Why isn\'t it—?',
      },
      {
        kind: 'voice',
        speaker: 'REPUTATION',
        text: 'You have their eyes. You do not yet have their fear — that\'s a separate thing and it has to be taken. The question is whether you take it with the name they might already know, or with a story you tell them right now.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'Two doors. Behind one, you say nothing and let them frighten themselves — costs nothing if your shape is enough. Behind the other, you talk, and you sell them a version of you worse than the real one — costs nothing if they can\'t hear the seams. Pick the door that fits what you actually are tonight.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'Whichever door. Mean it all the way through. The half-meant ones are the ones that get you opened up on a goblin\'s floor.',
      },
    ],
    choices: [
      {
        id: 'silent',
        text: 'Say nothing. Let the silence and the size of you do the work.',
        nextNodeId: 'goblin_terrify_success',
        check: { skillKey: 'reputation', failNodeId: 'goblin_terrify_fail' },
      },
      {
        id: 'threat',
        text: 'Take the floor before they can move. "Easy. Hands where they are. I came to talk — and you\'ll want to hear it before you decide anything."',
        nextNodeId: 'goblin_talk_open',
      },
      {
        id: 'bribe',
        text: '(come out of your coat with the grey handful, slow) "Before anyone reaches for anything — there\'s a thing here worth more to you than I am. Look at it before you decide."',
        nextNodeId: 'goblin_bribe_open',
        requiresUnlock: 'poison',
      },
      {
        id: 'divide',
        text: 'Hands open, slow. "I\'ve been listening from the dark. That thing you\'re arguing about — I want to know who found it first."',
        nextNodeId: 'goblin_divide_open',
      },
      {
        id: 'ally',
        text: 'Hands open, easy. "You\'re about to make a fast decision about me. Slow it down — I\'m worth more to you walking around down here than I am bled out on your floor. And I think the quiet one already knows it."',
        nextNodeId: 'goblin_ally_open',
      },
      {
        id: 'species',
        text: 'Don\'t step closer. Let the firelight do the work on your face. "You keep saying \'thing.\' Look again. I\'m not a thing. I\'m kin — the kind that comes up from the wet rooms you won\'t go down to. You\'ve just never seen one this far from the deep."',
        nextNodeId: 'goblin_species_open',
      },
    ],
  },

  // ── Ally-for-hire pitch ──────────────────────────────────────────────────────
  // Fiodor sells himself as worth more working than dead. The puzzle: GRIT holds
  // the decision; NIM prices everything and will auction the offer down against
  // you if you pitch him directly. Route around NIM to GRIT, let GRIT set the
  // terms, and the Deception check fires clean at goblin_ally_close. Pitch NIM,
  // oversell, lead with "muscle," or take NIM's price too fast and a
  // size_step_down rides into the check.
  //
  //   goblin_ally_open
  //     → goblin_ally_offer        (right: pitch the use to GRIT)
  //     → goblin_ally_nim_haggle   (wrong: pitch NIM — he auctions you → penalty/cornered)
  //     → goblin_ally_oversell     (wrong: "you need me" — desperation → penalty/cornered)
  //   goblin_ally_offer → finder / guide (clean) | fighter (→ penalty) → goblin_ally_nim_price
  //   goblin_ally_nim_price
  //     → goblin_ally_close        (right: hand the terms to GRIT)
  //     → goblin_ally_eager        (wrong: accept too fast → penalty → close)
  //     → goblin_cornered          (wrong: refuse the price — deal's dead)
  //   goblin_ally_close → Deception check → goblin_ally_success / goblin_ally_fail

  goblin_ally_open: {
    id: 'goblin_ally_open',
    narrative:
      'You don\'t reach for anything. You let the offer be the only thing moving in the room — a proposition set down in the open where all three can see there\'s no blade behind it. GRIT\'s eyes track to your empty hands, then back to your face. He\'s listening. That is not the same as buying.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Worth more. Everything down here that\'s about to die says it\'s worth more. What I want to know is worth more at WHAT — and worth more to WHO.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'To US. It said worth more to us. Which means it\'s already decided what we want and now it\'s going to sell it back to us at a markup. I\'ve watched this exact pitch get a thing exactly as far as the edge of the fire.',
      },
      {
        kind: 'passive',
        skillKey: 'deception',
        successInterjection: {
          speaker: 'DECEPTION',
          text: 'GRIT asked the real question — worth more to WHO. That\'s the whole lock. Aim the offer at him, and frame it as use, never as mercy. A thing like GRIT doesn\'t spare what\'s useful; he keeps it. Sell keeping, not sparing.',
        },
      },
      {
        kind: 'passive',
        skillKey: 'dangerSense',
        successInterjection: {
          speaker: 'DANGER SENSE',
          text: 'NIM is the appraiser, and an appraiser only profits if the thing comes in cheap. The second you put the offer in his hands he sets your price at nothing and pockets the gap. Do not let him hold it. Hand it to the one who can\'t resell you.',
        },
      },
    ],
    choices: [
      {
        id: 'to_grit',
        text: '(to GRIT) "Worth more to the one who has to keep three of you alive in a hole that keeps trying to empty itself. That\'s you. Not him. He counts coins. You count breathing bodies, and you\'re short."',
        nextNodeId: 'goblin_ally_offer',
      },
      {
        id: 'to_nim',
        text: '(to NIM) "You\'re the one who counts things. So count me. A working pair of hands that already knows these tunnels — put a number on that."',
        nextNodeId: 'goblin_ally_nim_haggle',
      },
      {
        id: 'oversell',
        text: '"You need me. You don\'t know it yet, but this hole is going to show you something you can\'t handle three-strong, and when it does you\'ll wish you\'d kept the big thing that offered to help."',
        nextNodeId: 'goblin_ally_oversell',
      },
    ],
  },

  goblin_ally_offer: {
    id: 'goblin_ally_offer',
    narrative:
      'It lands. Not as agreement — as the small, grudging stillness of a thing that has decided you\'re worth the cost of one more question. GRIT\'s weight settles back onto his heels. The whip stops slapping his thigh. BOLE looks between the two of you like a child watching adults decide something over his head.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Short. Maybe I\'m short. So talk to me, then — properly. What are you, that I\'d keep you instead of opening you?',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'This is the frame for everything after it. Don\'t pick the answer that sounds biggest — pick the one you can hold up under NIM\'s poking. Goblins understand things that find and things that lead. They mistrust things that fight for free.',
      },
      {
        kind: 'voice',
        speaker: 'REPUTATION',
        text: 'Whatever you name, name it like it\'s the dullest fact about you. The thing you\'re bored of being good at. Pride in it reads as the pitch; boredom reads as the truth.',
      },
    ],
    choices: [
      {
        id: 'finder',
        text: '"A finder. I read these tunnels for what\'s in them — metal, dry ground, the stuff worth carrying out. You three fought all night over one buckle. I\'d have shown you the room it fell off in."',
        nextNodeId: 'goblin_ally_nim_price',
      },
      {
        id: 'guide',
        text: '"A guide. I\'ve walked deeper than this and come back, which is more than most things down here can say. You move where I point and the hole stops being the thing that kills you."',
        nextNodeId: 'goblin_ally_nim_price',
      },
      {
        id: 'fighter',
        text: '"Muscle. Look at the size of me. You point me at a thing and the thing stops being a problem. That\'s worth three goblins\' worth of not-dying."',
        nextNodeId: 'goblin_ally_fighter',
      },
    ],
  },

  goblin_ally_fighter: {
    id: 'goblin_ally_fighter',
    narrative:
      'The word lands wrong and you feel it land wrong — the way GRIT\'s eyes go flat, the way the grudging stillness curdles back into calculation. You led with the one thing a creature your size should never offer first.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Muscle. A thing the size of you, offering to swing for strangers it met four breaths ago. No. Things that big don\'t hire on. They take over — or they\'re running from whatever already beat them. So which is it.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It\'s the second one. Look at it. Look at it deciding which lie patches the first lie. They always lead with the muscle when they\'ve got nothing under it.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You handed them the one offer that makes your size a threat instead of a tool. Now every word costs more — you\'re selling up out of a hole you dug in one sentence. Pivot to something a finder would say, and say it small.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Led with "muscle" — made your size read as a thing taking over, not hiring on' },
        ],
      },
    ],
    choices: [
      {
        id: 'pivot',
        text: '(level, unbothered) "Misspoke. Not muscle — I read tunnels, not throats. The size just means I carry more out than you can."',
        nextNodeId: 'goblin_ally_nim_price',
      },
    ],
  },

  goblin_ally_nim_price: {
    id: 'goblin_ally_nim_price',
    narrative:
      'NIM has stopped arguing that you\'re a liar — which is worse, because it means he\'s decided you might be real, and real things can be taxed. He steps forward, the buckle still fisted in one hand, and you watch him reach for the part of this he can profit from.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Fine. FINE. Say it\'s real. Then it costs — everything real costs. You want to walk with us, you give first. The coat. Or whatever\'s sewn in the coat. Or you go back up that tunnel and bring down the thing you\'re so good at finding, and we keep the buckle till you do. Pick one. Show us it\'s real.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'That\'s — Nim, that\'s clever. That\'s actually clever. Make it pay before it gets anything. I like that one.',
      },
      {
        kind: 'passive',
        skillKey: 'deception',
        successInterjection: {
          speaker: 'DECEPTION',
          text: 'The price is the trap, not the deal. Pay it and you\'re a supplicant — a thing that gives tribute isn\'t an ally, it\'s a mark. Refuse it flat and you\'re the liar NIM said you were. The move is neither: don\'t answer the appraiser at all. Make GRIT set the terms, because GRIT setting terms means GRIT has already decided to keep you.',
        },
      },
    ],
    choices: [
      {
        id: 'defer_grit',
        text: '(to GRIT, not NIM) "I\'m not haggling with the man who counts coins. You\'re the one who has to live with whatever walks behind you in the dark. You set the terms. I\'ll meet the ones that are real."',
        nextNodeId: 'goblin_ally_close',
      },
      {
        id: 'accept_fast',
        text: '"Done. The coat, the lot, whatever you want — just say we have a deal and let\'s move."',
        nextNodeId: 'goblin_ally_eager',
      },
      {
        id: 'refuse',
        text: '"I\'m not paying tribute to do you a favour. The offer is the offer. Take it or swing."',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_ally_eager: {
    id: 'goblin_ally_eager',
    narrative:
      'The word is out of you before you\'ve weighed it, and the speed of it lands in the room like a dropped coin — everyone hears the metal. NIM\'s whole face changes. You just told him exactly how much you want past this fire, which is the one number he was fishing for.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'See how FAST. Did you hear it? Things that mean a deal haggle the deal. Things that just want past you say yes to everything, fast, all at once, because the yes was never the point — the GETTING-PAST was the point. It just told us the whole game.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You priced yourself by how badly you wanted out, and NIM read the price off your face. An ally negotiates because an ally expects to still be here tomorrow. Only a thing that\'s leaving agrees to anything. Slow it down. Take it off the appraiser and put it back on GRIT before NIM finishes the sale.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Accepted too fast — the speed told NIM exactly how badly you want past the fire' },
        ],
      },
    ],
    choices: [
      {
        id: 'recover',
        text: '(slow, deliberate, to GRIT) "Fast because it\'s cheap to me — the coat\'s just a coat. Doesn\'t change the offer. Your call, keeper. Not his."',
        nextNodeId: 'goblin_ally_close',
      },
    ],
  },

  goblin_ally_close: {
    id: 'goblin_ally_close',
    narrative:
      'It comes back to GRIT, the way you spent the whole conversation steering it to. He hasn\'t spoken since the question. NIM has run out of new things to say and is now just watching GRIT\'s face, which is the tell — even NIM has decided the answer lives there. This is the seam: the breath between the last word and the decision, where the offer either holds its shape or comes apart.',
    beats: [
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'Don\'t sweeten it. The instinct now is to add one more reason — that\'s the reflex that kills deals, because a deal that needs one more reason wasn\'t closed. You set it in front of him. Let him pick it up. The silence is doing your work; don\'t step on it.',
      },
      {
        kind: 'voice',
        speaker: 'REPUTATION',
        text: 'He\'s not weighing whether you\'re lying. He stopped caring about that two answers ago. He\'s weighing whether a useful thing is worth the trouble of watching it. Be worth watching. Be still.',
      },
    ],
    choices: [
      {
        id: 'wait',
        text: 'Say nothing more. Let GRIT set it down.',
        nextNodeId: 'goblin_ally_success',
        check: { skillKey: 'deception', failNodeId: 'goblin_ally_fail' },
      },
    ],
  },

  goblin_ally_success: {
    id: 'goblin_ally_success',
    narrative:
      'GRIT looks at you for a long moment, and then he does the thing that from a creature like him passes for a handshake: he names the terms himself, out loud, in front of the other two, so the deal becomes a thing the room has witnessed and can\'t quietly un-witness later. You are not a friend. You are a tool that has been judged, for tonight, too useful to break.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'One job. You find us the room you say you can find. You walk in front, where I can see your hands the whole way. You try one thing in the dark and the whip is around your neck before the thought finishes. ...That\'s the deal. Bole. Let it pass.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Okay. Okay, Grit. (to you) You really know a room with more than one buckle in it?',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'This is a mistake. This is a MISTAKE, Grit, you\'re going to remember I said — fine. FINE. But I\'m keeping the buckle.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You didn\'t sell them a friend. There\'s no such thing down here. You sold them a tool too useful to break tonight — and "tonight" is the only contract a hole like this honours. Walk in front. Keep your hands where he can see them. Be gone before tonight runs out.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Walk in front. Hands visible. Take the passage.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_ally_fail: {
    id: 'goblin_ally_fail',
    narrative:
      'GRIT does the math the other way. You watch it happen — the small final shake of the head, the weight coming back up onto the balls of his feet. He found the hole in the offer, the one you couldn\'t paper over, and the hole was you.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'No. A thing as useful as you say would\'ve been used already — kept by someone who knew what it was worth. You\'re loose down here, alone, pitching to goblins. Means somebody already did this exact sum and let you walk. I don\'t take another thing\'s leavings.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'THERE it is. I said it. I said it from the start — the words run out and then you see what was under them. Get it, Grit. Get it before it tries the next pitch.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'He found the seam: the most useful version of you wouldn\'t be wandering a hole alone, selling itself to the first fire it found. There\'s no patch for that one. The offer\'s dead. Only the other thing left now.',
      },
    ],
    choices: [
      { id: 'fight', text: 'No deal, then. The hard way.', nextNodeId: 'goblin_cornered' },
    ],
  },

  goblin_ally_nim_haggle: {
    id: 'goblin_ally_nim_haggle',
    narrative:
      'NIM\'s eyes light up, and you understand your mistake in the same instant he does. You handed the offer to the one creature in the room who only makes money if you come in cheap — and he takes it, and he turns to the others, and he starts selling them a version of you priced at almost nothing.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'A NUMBER. It wants a number. All right — here\'s the number. One pair of hands, yes, attached to a thing too big to feed, too loud to sneak, too stupid to know it walked up to three blades and asked for a JOB. That\'s not worth keeping. That\'s worth taking what it\'s carrying and being done. THAT\'S the number, Bole.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...it is pretty big to feed.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'He\'s holding your price now, and every second he talks it drops. You gave the creature who profits from your worthlessness the job of deciding what you\'re worth. The only way back is to take the offer out of his hands entirely — over his head, to GRIT — and you\'ll have to do it from underneath the number he just set.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Pitched the appraiser — NIM set your value at nothing in front of the room' },
        ],
      },
    ],
    choices: [
      {
        id: 'over_his_head',
        text: '(cut past NIM, straight to GRIT) "He\'s counting what I\'m carrying. Count what I\'m worth instead — that\'s a different sum, and it\'s yours to do, not his."',
        nextNodeId: 'goblin_ally_offer',
      },
      {
        id: 'keep_haggling',
        text: '(to NIM) "Too big to feed? I eat what I find, and I find more than you. Sit down and let me show you the difference."',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_ally_oversell: {
    id: 'goblin_ally_oversell',
    narrative:
      'It comes out heavier than you meant it — closer to a warning than an offer — and the room hears the seam in it. A thing that is genuinely needed does not need to announce it. The announcing is the tell, and all three of them catch it at once.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Hear that? "You NEED me." That\'s not what help sounds like. That\'s what a thing says when it\'s got nothing left but a guess about the future and a hope you\'re scared of the dark. We LIVE in the dark. It\'s our dark.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Anything that tells me what I need is selling me the need first and itself second. I\'ve been down here longer than you\'ve been alive, long thing. I know what I need. It isn\'t you.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You sold the fear instead of the use, and they don\'t scare on schedule. There\'s one thread left: drop the prophecy entirely, name a flat concrete thing you can do, and aim it at GRIT — the keeper, never the room. You\'re climbing out of a hole now, but the climb still exists.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Oversold the need — pitched their fear to creatures who live in the dark by choice' },
        ],
      },
    ],
    choices: [
      {
        id: 'pivot_use',
        text: '(drop it, level, to GRIT) "Fair. Forget what you need. Here\'s what I do — I read these tunnels for what\'s in them, and I\'d have found you a better room than the one with one buckle in it."',
        nextNodeId: 'goblin_ally_offer',
      },
      {
        id: 'double_down',
        text: '"Laugh now. When the deep part of this hole comes up to meet you, remember the thing that warned you and walk away."',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  // ── "I'm a different kind of goblin" claim ───────────────────────────────────
  // The hardest social path: the claim has to survive three different scrutinies.
  // BOLE half-believes (the danger — fumble and he turns); NIM tries to monetize
  // the claim rather than disprove it; GRIT says almost nothing and watches the
  // body, then asks one flat question that is the real check. A Dungeon Lore
  // passive up front decides whether you actually know goblin-kinds well enough
  // to lean on the lore — pass it and a size_step_up rides into the final
  // The Deep check; fail it and you improvise blind. The recurring trap is
  // KNOWING TOO MUCH: real kin don't recite their own taxonomy, don't lecture,
  // don't correct invented kin-law. Every over-explanation is a size_step_down.
  //
  //   goblin_species_open  (Dungeon Lore passive → bonus or blind)
  //     → goblin_species_bole       (vague/physical, or name the kind plainly)
  //     → goblin_species_overclaim  (trap: prove it with taxonomy → penalty → bole)
  //   goblin_species_bole
  //     → goblin_species_nim        (small confirmation, redirect to the body)
  //     → goblin_species_explain    (trap: lecture/fake the song → penalty → nim)
  //   goblin_species_nim
  //     → goblin_species_grit       (accept the frame, concede something costless)
  //     → goblin_species_correct    (trap: fix NIM's kin-law → penalty → grit)
  //     → goblin_cornered           (refuse the frame — you break your own story)
  //   goblin_species_grit → The Deep check → goblin_species_success / _fail

  goblin_species_open: {
    id: 'goblin_species_open',
    narrative:
      'The word lands differently than a threat would. Kin. It\'s a claim, not a fight, and a claim has to be answered before it can be acted on — so for one held breath all three of them are doing the same arithmetic, measuring you against the shape of every goblin they\'ve ever known and finding you both wrong and not wrong enough to dismiss. BOLE\'s mouth is open. NIM\'s eyes have narrowed to coins. GRIT has not moved at all.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Kin? It\'s — Grit, is it kin? It\'s too big to be kin. But the wet rooms — Mother said things grow different down where it\'s wet, said they come back wrong, says it like a warning but maybe wrong is just — bigger? Grit, could it be a wet-room one?',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It is not KIN, Bole, kin doesn\'t walk up out of the dark and announce it\'s kin, that\'s the whole — a real one would just BE one, you\'d know, you wouldn\'t have to be TOLD. ...Although. Hm. If it were, though. If. Kin shares. Doesn\'t it. Kin owes.',
      },
      {
        kind: 'passive',
        skillKey: 'dungeonLore',
        successInterjection: {
          speaker: 'DUNGEON LORE',
          text: 'You know this lore — better than they do, which is the trap and the gift both. There are deep-kin: pale, oversized, raised by the wet rooms, spoken of and almost never seen. The story does the work for you here — but only if you wear it like a thing you ARE, not a thing you KNOW. Claim it small. Let their own legend fill the rest.',
        },
        successBonuses: [
          { type: 'size_step_up', skillKey: 'theDeep', sourceDescription: 'You know the deep-kin lore — the legend carries weight you don\'t have to invent' },
        ],
        failInterjection: {
          speaker: 'SUPERSTITION',
          text: 'You don\'t know the first thing about goblin-kinds — but you know the shape of a belief, and these three are already half inside one. Don\'t supply details you don\'t have. Stand in the gap their own fear is making and let them furnish it.',
        },
      },
    ],
    choices: [
      {
        id: 'vague_physical',
        text: '(let the size and the stillness be the argument) "You said it yourself. Things grow different in the wet. You don\'t see the deep-kind because the deep-kind don\'t come up. I came up."',
        nextNodeId: 'goblin_species_bole',
      },
      {
        id: 'name_kind',
        text: '(flat, like a dull fact) "Deep-kin. From the rooms under the rooms — the wet dark your mother told you not to go down to. She was right not to."',
        nextNodeId: 'goblin_species_bole',
      },
      {
        id: 'overclaim',
        text: '(prove it — recite what you know) "There are six kinds below the surface kind. Mire-born, pale-kin, the gravecrawlers in the third dark — I\'m of the deep-kin, fourth dark, and I can name the others if your keeper wants the catechism."',
        nextNodeId: 'goblin_species_overclaim',
      },
    ],
  },

  goblin_species_overclaim: {
    id: 'goblin_species_overclaim',
    narrative:
      'You recite it cleanly, every kind in its order — and the recitation is the mistake. You watch NIM\'s face change as you talk, the suspicion curdling into something worse: certainty. A thing that has to list its own bloodline like a merchant listing stock has never lived inside that bloodline a day in its life.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Listen to it. LISTEN. It knows the whole list. Do you know our list, Bole? Could you name the six kinds in order? No — because you ARE one, you don\'t carry it around in your mouth ready to perform. Only a thing that LEARNED us talks like that. It studied us. It studied us to wear us.',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'You proved knowledge when you needed to prove blood. Knowledge can be got from anywhere — a captured kinsman, a scholar\'s page, a long bad night listening at a fire. Blood is the thing you can\'t recite. Stop naming. Be vague the way a real one is vague — bored, half-remembering, certain without proof.',
        penalties: [
          { type: 'size_step_down', skillKey: 'theDeep', sourceDescription: 'Recited the taxonomy — proved you studied them, not that you are them' },
        ],
      },
    ],
    choices: [
      {
        id: 'go_vague',
        text: '(stop performing; go dull and certain) "...Or don\'t make me list them. Kin doesn\'t quiz kin. I\'m deep-kind. You feel the wrongness of me — that\'s the only proof either of us needs."',
        nextNodeId: 'goblin_species_bole',
      },
    ],
  },

  goblin_species_bole: {
    id: 'goblin_species_bole',
    narrative:
      'BOLE takes a step toward you — not a threatening one, a curious one, which is worse, because it means he\'s halfway to believing and a half-belief is a thing you can lose. He\'s looking up at your face with the desperate openness of someone who wants the story to be true. And then he asks the question, the guileless one, the one that tests you precisely because he doesn\'t mean it to.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'If you\'re deep-kin — then you know the cold-song? The one for the wet rooms, the down-song, the one Mother said the deep ones sing so the dark knows them and lets them by? Sing me a little of it. Just a little. Then I\'ll know.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: '...That\'s a good question, Bole.',
      },
      {
        kind: 'passive',
        skillKey: 'deception',
        successInterjection: {
          speaker: 'DECEPTION',
          text: 'Careful — BOLE asked for a little. Give him a lot and you\'re performing for NIM, who is praying you\'ll try to sing a song you don\'t know. You can\'t produce the cold-song. So don\'t. Refuse it the way a real one would — with weight, not with a fumble. Make the not-singing mean something.',
        },
      },
    ],
    choices: [
      {
        id: 'refuse_with_weight',
        text: '(low, almost gentle) "The cold-song isn\'t sung up here, Bole. Up here it\'s just sound. Down there it\'s the only thing between you and what listens. I won\'t spend it on a campfire. Ask me something that costs less."',
        nextNodeId: 'goblin_species_nim',
      },
      {
        id: 'shared_hardship',
        text: '(let the deep be a wound, not a song) "You don\'t ask a thing to sing about the wet rooms, Bole. You weren\'t down there. I was. Some of us came up so we\'d never have to hear that song again."',
        nextNodeId: 'goblin_species_nim',
      },
      {
        id: 'try_to_sing',
        text: '(give him the song — improvise something low and strange) Hum something from the back of the throat, slow and wrong-sounding, and hope it reads as deep enough.',
        nextNodeId: 'goblin_species_explain',
      },
    ],
  },

  goblin_species_explain: {
    id: 'goblin_species_explain',
    narrative:
      'You make the sound — low, deliberate, strange as you can shape it — and for one second BOLE\'s face opens like a door. Then NIM laughs, a short ugly bark, because NIM has heard goblins sing and you are not singing. You are a large thing making a noise it hopes is a song, and the gap between those two things is exactly where you live now.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'THAT\'S not it. That\'s not ANY of it. That\'s a — Bole, that\'s a thing that heard ONCE that we sing and is GUESSING at it. The cold-song doesn\'t go like that. Nothing goes like that. It made up a song to prove it knew our song. Do you HEAR how backwards that is?',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...it didn\'t sound right. I wanted it to. It didn\'t.',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'You tried to produce a holy thing on demand and produced a counterfeit instead. The only repair is to make the counterfeit a choice — that you gave him a hollow version on purpose, because the real one isn\'t for here. Thin. But a real one would never have tried at all, so sell the refusal you should have led with.',
        penalties: [
          { type: 'size_step_down', skillKey: 'theDeep', sourceDescription: 'Faked the cold-song — NIM has heard the real one and you have not' },
        ],
      },
    ],
    choices: [
      {
        id: 'recover',
        text: '(cut it off, cold) "No. That\'s the husk of it — what\'s left when you take the song somewhere it doesn\'t belong. That\'s all this fire gets. The whole of it stays down where it works."',
        nextNodeId: 'goblin_species_nim',
      },
    ],
  },

  goblin_species_nim: {
    id: 'goblin_species_nim',
    narrative:
      'NIM has given up trying to catch you in the lie. You can see the exact moment he switches tactics — because if he can\'t prove you\'re not kin, the next best thing is to act as though you are, loudly, in a way that costs you. He turns the claim into a debt.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Fine. FINE. Say it\'s kin. Then kin-law holds, doesn\'t it — the old one, the sharing one. Deep-kin that crosses surface-kin\'s fire owes the fire a tithe, that\'s LAW, that\'s older than the buckle. So tithe. Empty the coat. Kin to kin. Unless it\'d rather admit it doesn\'t know the law because it isn\'t—',
      },
      {
        kind: 'passive',
        skillKey: 'dangerSense',
        successInterjection: {
          speaker: 'DANGER SENSE',
          text: 'There is no such kin-law. He invented it three seconds ago to make you choose: pay, and you fund his suspicion; correct him, and you prove you carry kin-law in your head like a scholar, which no real kinsman does. Both doors are his. Take the third — accept the frame, concede a thing that costs you nothing, and never touch the details.',
        },
      },
    ],
    choices: [
      {
        id: 'concede_costless',
        text: '(to NIM, unbothered) "Kin shares danger, not coin — that\'s the law, the part of it that\'s real. And I already shared mine: I told you the deep is awake. That\'s the only tithe worth the name. The coat\'s just a coat."',
        nextNodeId: 'goblin_species_grit',
      },
      {
        id: 'correct_law',
        text: '(scoff — set him straight) "That\'s not kin-law and you know it. The tithe runs deep-to-surface only at the turning of the dark, and only in salt or in blood, never coin. Don\'t quote law at a thing that was raised on it."',
        nextNodeId: 'goblin_species_correct',
      },
      {
        id: 'refuse_frame',
        text: '"Kin owes you nothing. I came up from a place that would eat this whole fire and not notice. Don\'t talk to me about tithes."',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_species_correct: {
    id: 'goblin_species_correct',
    narrative:
      'It works, for half a heartbeat — NIM actually falters, caught out in his invented law. And then you watch the falter turn into something far more dangerous, because you didn\'t just refuse the tithe. You out-lawyered him. You produced kin-law more detailed than his own, salt and blood and the turning of the dark, and a thing that carries that much law in its mouth has studied it the way you study a thing you weren\'t born to.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'salt or in blood... at the turning of the dark... HOW DO YOU KNOW THAT. I made up the law and you fixed it — you fixed my made-up law with a BETTER one — Bole, does that sound like kin to you or does that sound like the most studied liar either of us has ever — it has FOOTNOTES. Kin doesn\'t have footnotes.',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'You won the small fight and lost the big one. The most a real kinsman ever says about kin-law is "that\'s not how it goes" — flat, bored, no detail, because to him it isn\'t knowledge, it\'s just air. You gave him the recital again. Get back to bored. Make GRIT\'s question the only thing in the room.',
        penalties: [
          { type: 'size_step_down', skillKey: 'theDeep', sourceDescription: 'Out-lawyered NIM — proved you studied kin-law instead of living it' },
        ],
      },
    ],
    choices: [
      {
        id: 'back_to_bored',
        text: '(wave it off, suddenly tired of him) "It just goes how it goes. I don\'t keep it in my head — I keep it in my legs, like you\'re supposed to. Ask your keeper. He\'s the one still deciding."',
        nextNodeId: 'goblin_species_grit',
      },
    ],
  },

  goblin_species_grit: {
    id: 'goblin_species_grit',
    narrative:
      'GRIT steps forward for the first time since you spoke. He hasn\'t taken part in any of it — not BOLE\'s wonder, not NIM\'s lawyering — and that silence has been him doing the only thing that matters, which is watching the way you hold your body when you think the words are doing the work. Now he\'s close. He looks up at you, and the whip is loose in his hand, and he asks the one question the whole performance was always going to come down to.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'I\'ve met deep things. Not your story-kind — real ones, things that came up wrong out of the wet. They all had the same thing in the eyes. The down-look. Like part of them never finished climbing out. ...Show me the down-look. Right now. Or stop wasting the last quiet you\'re going to get.',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'He\'s not asking for a fact. He\'s asking you to BE the thing for one second — to put the deep behind your eyes. You can\'t fake a fact you don\'t have, but you can hold a silence like it has a hole in the bottom of it. Think of the lowest, worst dark you\'ve ever stood in. Let that be what he sees. Don\'t perform it. Just remember it, and let him watch you remember.',
      },
      {
        kind: 'voice',
        speaker: 'THE DEEP',
        text: 'You have stood in the real dark. You didn\'t come back from it unmarked. That\'s the one true thing in this whole lie — use it. The down-look isn\'t a trick if part of you never climbed out either.',
      },
    ],
    choices: [
      {
        id: 'give_the_look',
        text: 'Hold his eyes. Stop performing. Let the worst dark you ever stood in rise up behind your face — and let GRIT look all the way down into it.',
        nextNodeId: 'goblin_species_success',
        check: { skillKey: 'theDeep', failNodeId: 'goblin_species_fail' },
      },
    ],
  },

  goblin_species_success: {
    id: 'goblin_species_success',
    narrative:
      'You don\'t reach for the deep. You let it come up on its own — the wet black of the lowest room you ever crawled out of, the cold that had opinions, the silence that was waiting — and it rises behind your eyes without any help from you, because it was always there. GRIT looks into it. And whatever he\'s checking your face against, your face passes, because for one second you are not lying. You are just remembering, and the remembering looks exactly like what he asked for.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: '...Huh. There it is. (a long pause, and the whip-hand lowers) I don\'t know what you are, long thing. But that\'s not a learned look. Nobody studies that into their face. Bole — back up. Give the deep-kind its road.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'I KNEW it. I knew it wasn\'t a thing to eat. (quiet, almost reverent, as you pass) ...does it ever stop? The cold. Does it ever stop being down there?',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'This is — you\'re ALL — fine. FINE. But when it comes back as something with teeth, I want it remembered that I was the only one who—  ...just go. Go on. Kin.',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'You didn\'t out-lie them. You found the one true thing inside the lie and stood on it, and truth holds weight a performance never can. That\'s the whole secret of the down-look: it only works on the ones who really went down. Walk like you\'re going back. Part of you always is.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Take the road they made. Don\'t look back at the fire.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_species_fail: {
    id: 'goblin_species_fail',
    narrative:
      'You try to give him the look — and trying is the whole problem. GRIT watches you reach for it, watches you arrange your face into what you think the deep should look like, and the arranging is the tell. Real depth doesn\'t compose itself. It just sits there, already ruined. He sees you build the expression, and a built thing is a made thing, and a made thing is a lie.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'No. That\'s a face putting on a face. The real ones don\'t have to find the look — they can\'t lose it. You went looking for yours, which means you don\'t carry it, which means you\'ve never been down, which means you\'re a clever thing in a good coat that read about us somewhere. ...Pity. Bole, Nim. It\'s not kin. It\'s just dinner that talks.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'I SAID. From the first word — I SAID it wasn\'t — get it, get it now before it finds another story—',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'You went looking for the deep instead of letting it find you, and the reaching showed. The lie needed one true thing under it and you tried to fake even that. There\'s nothing left to say now. Only the other thing.',
      },
    ],
    choices: [
      { id: 'fight', text: 'The story\'s over. The hard way starts now.', nextNodeId: 'goblin_cornered' },
    ],
  },

  // ── Spoken threat conversation ───────────────────────────────────────────────
  // The check doesn't come at the start — it has to be earned by reading the
  // room correctly. The correct read: GRIT holds the decision, NIM holds the
  // noise. Engaging NIM hands him a stage; speaking to all three means none of
  // them have to decide alone. Thread it right and the Deception check fires
  // at full in goblin_talk_close. Thread it wrong and either a size_step_down
  // travels into the check, or the lie collapses before the dice come out.
  //
  //   goblin_talk_open
  //     → goblin_talk_grit          (right read: answer GRIT specifically)
  //         → goblin_talk_close     (ideal: ignore NIM, keep eyes on GRIT)
  //         → goblin_talk_nim_enter (mistake: engage NIM → penalty → close)
  //     → goblin_talk_room          (wrong read: play to the whole room)
  //         → goblin_talk_close     (recovery: cut the theater, find GRIT → penalty)
  //         → goblin_cornered       (doubled down: NIM was right, they close in)
  //   goblin_talk_close → Deception check → goblin_threat_success / goblin_threat_fail

  goblin_talk_open: {
    id: 'goblin_talk_open',
    narrative:
      'You open your mouth and the chamber rearranges itself around the fact of it — now there is a voice in here that isn\'t theirs, and all three of them are sorting out what that means. GRIT is waiting to hear the rest. His expression hasn\'t changed. That\'s either patience or it\'s something worse.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'It talks. Grit, it talks. I thought it was just going to — I don\'t know what I thought it was going to do. But it talks.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Oh good. Another big thing with words. I\'ve seen big things with words before. The words always run out eventually. Then you get to see what was under them the whole time.',
      },
      // Gated read: only surfaces if your Danger Sense is sharp enough to clock
      // NIM as the thing that unravels you. Fail it and you go in blind.
      {
        kind: 'passive',
        skillKey: 'dangerSense',
        successInterjection: {
          speaker: 'DANGER SENSE',
          text: 'NIM is the one who\'ll pull it apart if you give him anything to pull. He\'s reading you like a length of rope — testing for the weak braid, the place where you snap. Don\'t hand him an end.',
        },
      },
      // Gated read: the actual answer key. High Deception sees that GRIT holds
      // the decision and NIM is just noise. Fail it and you have to feel that out.
      {
        kind: 'passive',
        skillKey: 'deception',
        successInterjection: {
          speaker: 'DECEPTION',
          text: 'GRIT asked the question. GRIT holds the decision — not NIM, not BOLE. NIM is noise that GRIT is already half-tired of. Answer the one that matters. You don\'t have to do anything with the other two; GRIT will handle them the moment he decides they need handling.',
        },
      },
    ],
    choices: [
      {
        id: 'answer_grit_past',
        text: '(to GRIT) "You asked what I am. Easier to tell you what I left. The last thing that cornered me is still in the tunnel behind you. Most of it."',
        nextNodeId: 'goblin_talk_grit',
      },
      {
        id: 'answer_grit_cost',
        text: '(to GRIT) "You\'re already doing the sum. Three of you, one of me. Do the other one — what\'s left of three afterward, and whether a buckle was worth the difference."',
        nextNodeId: 'goblin_talk_grit',
      },
      {
        id: 'answer_room',
        text: '(to all three) "Listen close, all of you. You\'ve made one mistake tonight. The only thing left to settle is how much it costs."',
        nextNodeId: 'goblin_talk_room',
      },
    ],
  },

  goblin_talk_grit: {
    id: 'goblin_talk_grit',
    narrative:
      'Something shifts. GRIT\'s jaw doesn\'t move but his eyes do — a small, sideways adjustment, the kind a careful thing makes when it\'s quietly updating its estimate of a situation. BOLE has gone very still in the way large animals go still when they\'re unsure which direction the threat is pointing. NIM reads the shift and doesn\'t like what he reads, which is why he starts talking.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Nim. Nim, be quiet a minute. Let Grit — just let him think a minute.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'No. Don\'t let it talk. That\'s exactly what it wants — the talking, that\'s the whole trick of it. It\'s one thing and there\'s three of us and the math hasn\'t CHANGED, the math doesn\'t care how it talks, GRIT—',
      },
      // Gated read: high Deception sees NIM's noise for what it is and tells you
      // not to take the bait. Fail it and engaging him looks tempting.
      {
        kind: 'passive',
        skillKey: 'deception',
        successInterjection: {
          speaker: 'DECEPTION',
          text: 'NIM is scared. That\'s good — a scared thing makes noise because silence is what it would make if it were certain. Don\'t look at him. Not even to dismiss him. Let GRIT decide what NIM is worth, in this moment, without any help from you. GRIT is already doing the math. Let him finish it.',
        },
      },
    ],
    choices: [
      {
        id: 'ignore_nim',
        text: 'Eyes on GRIT — let NIM bark. "He\'s loud because he\'s scared. You\'re quiet because you\'re deciding. I\'ll wait on the one who\'s deciding."',
        nextNodeId: 'goblin_talk_close',
      },
      {
        id: 'address_nim',
        text: 'Round on NIM. "You. The mouth. Keep going and you\'ll talk these two into something none of you walk out of."',
        nextNodeId: 'goblin_talk_nim_enter',
      },
    ],
  },

  goblin_talk_nim_enter: {
    id: 'goblin_talk_nim_enter',
    narrative:
      'You look at NIM. And NIM, who has been waiting for exactly this opening, already has something ready. Of course he does.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Oh NOW it looks at me. NOW it decides I\'m worth — after it said its careful thing for GRIT and now it needs to handle ME separately because I\'m the difficult one. Yes. I\'m the difficult one. I\'ve always been the difficult one. That\'s how I\'m still HERE.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'He\'s not wrong.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You gave him a stage and he built a whole theater on it in four seconds. He\'s not louder than you — he\'s sharper in this particular corner, and sharpness in a small space beats loud every time. GRIT just watched you lose half the room you built. Don\'t add a word. Find GRIT\'s eyes and finish what you started there.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Lost ground engaging NIM — he\'s better at this than you in here' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'This is what it looks like when the walls of a thing start to show. You\'ve seen it from the outside. Don\'t keep talking — more words digs the hole deeper. Get back to GRIT. The decision still lives in GRIT.',
      },
    ],
    choices: [
      {
        id: 'back_to_grit',
        text: 'Back to GRIT, and not another word for NIM. "Forget him. I was talking to you."',
        nextNodeId: 'goblin_talk_close',
      },
    ],
  },

  goblin_talk_room: {
    id: 'goblin_talk_room',
    narrative:
      'You speak to all three and it goes wrong the moment you do it — you feel it before you hear it, the way you feel a foot misplaced in the dark before the sound arrives. Speaking to the room means none of them has to decide alone, and things that don\'t have to decide alone don\'t decide to be frightened.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'THAT. Right there — d\'you hear it, Bole? The performance voice. The thing in the upper tunnels had it. The thing at the Crag had it. Right before Scratt opened them up and they stopped performing. You know the performance voice.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...yeah. Yeah, I know the performance voice.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Hm.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'NIM named it. Once the name is on a thing it stops being frightening and starts being a category, and everything in the category is manageable. You have two words, maybe three, before GRIT assigns you to the list of things that didn\'t make it past his fire.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'NIM is a write-off — don\'t touch him, he\'s already won his corner. GRIT is the only path left. Find his eyes, cut every piece of theater out of it, and say the one specific true-sounding thing plain, like you\'re reporting weather. It\'s thin. It\'s the only thread you\'ve got.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'NIM named the performance — GRIT is halfway unconvinced already' },
        ],
      },
    ],
    choices: [
      {
        id: 'recover',
        text: 'Drop the performance. Find GRIT alone. "Strip all that. One thing, true: the last fire I walked up to is cold now. Yours doesn\'t have to be."',
        nextNodeId: 'goblin_talk_close',
      },
      {
        id: 'double_down',
        text: 'Bigger. Louder. Make them feel the weight of it. "You have no idea what you\'ve let in here tonight—"',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_talk_close: {
    id: 'goblin_talk_close',
    narrative:
      'The chamber settles around the last thing you said. GRIT hasn\'t moved. NIM has stopped. BOLE is watching GRIT instead of you, which is the tell — he\'s decided already that GRIT\'s face is the answer, and GRIT\'s face hasn\'t given it yet. This is the seam of it. The part between the last word and the decision, where the whole structure either holds or it doesn\'t. You can feel them inside it. The question is what GRIT decides the silence means.',
    beats: [
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'Don\'t add anything. The instinct to fill this silence is exactly how lies come apart — the one extra word, the explaining, the patch that shows the hole it was covering. You said the thing. Let it sit. Let him do the last piece of the work himself.',
      },
      {
        kind: 'voice',
        speaker: 'SUPERSTITION',
        text: 'Old rule: never be the second thing to speak after a silence this shape. Whatever lives in that shape, it\'s working for you. Don\'t kill it.',
      },
    ],
    choices: [
      {
        id: 'hold',
        text: 'Say nothing more. Let it sit on him.',
        nextNodeId: 'goblin_threat_success',
        check: { skillKey: 'deception', failNodeId: 'goblin_threat_fail' },
      },
    ],
  },

  goblin_terrify_success: {
    id: 'goblin_terrify_success',
    narrative:
      'You don\'t say a word. You let the silence stretch and you let them fill it themselves — which is the whole cruelty of it, because whatever each of them imagines is worse than anything you could have said. You just stand there and be the thing in the doorway, upright and unhurried. Something registers — maybe the name, maybe the posture, maybe only that you don\'t look like something that expects to lose. One of them breaks first. Then the other two follow. The chamber empties toward the far passage in a shrieking scatter. The pacing one is last. He looks back once. You hold his gaze. He goes.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Leave it — LEAVE it, Bole, it\'s not worth the buckle, nothing\'s worth — GO—',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'Show them. SHOW them what they\'re dealing with. Good. Now let them carry it.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'You didn\'t slow down. Didn\'t flinch. That was the whole of it — the body believed it so they had to.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'I know what you are. I didn\'t, and now I do. We were never going to be the worst thing in this tunnel tonight.',
      },
      {
        kind: 'voice',
        speaker: 'REPUTATION',
        text: 'They knew. Maybe not the name — the shape of the thing. You\'ve made yourself into something that registers down here. That was the work of a long time. It just paid out.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Watch them go. The chamber is yours now.', nextNodeId: 'goblin_fled' },
    ],
  },

  goblin_terrify_fail: {
    id: 'goblin_terrify_fail',
    narrative:
      'You give them the silence. The stillness, the unbothered weight, the wordless certainty of a thing that has done this before. And they look at it — and they don\'t break. The pacing one takes a step toward you. The arguing pair close together and then spread apart in a practiced way that says: this isn\'t the first time something bigger walked in and tried the quiet act on them. One of them grins. It\'s the kind of grin that lives in dungeons because everything that wore it survived long enough to grow teeth.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'No. No, I don\'t think so. I\'ve watched big things bleed out on this floor before. You walk like you\'ve never been opened up. You bleed like anyone.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Get it. Get it before it remembers it should\'ve run.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Don\'t let the body show it. They\'re reading you right now — whatever they just saw, don\'t give them more.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'They didn\'t run. Fine. Do it the other way.',
      },
      {
        kind: 'voice',
        speaker: 'REPUTATION',
        text: 'Read it wrong. They don\'t know the name, or they don\'t care. You\'ve been down here long enough to matter — just not to them, not today.',
      },
    ],
    choices: [
      {
        id: 'words',
        text: 'The silence didn\'t land. Fill it — change the story before it finishes hardening.',
        nextNodeId: 'goblin_talk_desperate',
      },
      { id: 'fight', text: 'Then we do it the hard way.', nextNodeId: 'goblin_cornered' },
    ],
  },

  // Fallback from a failed wordless attempt: you can still talk, but you start
  // in the hole the silence dug. They've already priced your menace at zero, so
  // the spoken pitch enters mid-collapse with a Deception penalty that travels
  // into the check at goblin_talk_close. Reachable only from goblin_terrify_fail.
  goblin_talk_desperate: {
    id: 'goblin_talk_desperate',
    narrative:
      'So you talk. You change tactics in the open air, mid-breath, the silent thing folding into a speaking thing right in front of them — and they watch you do it. That\'s the problem. They watched the strong silent thing fail to be frightening, and now the same thing is talking, which means the talking is the second attempt, and everyone in the room can count to two. You are selling danger to a room that just watched the danger not show up.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Oh, NOW it\'s got words. Now. Didn\'t have them when it was doing the big quiet stare, did it, but the stare didn\'t take so out come the words. That\'s not a dangerous thing, Grit. That\'s a thing trying its second idea.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Go on, then. Second idea. Let\'s hear it. Quick, though — I was nearly finished deciding.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'This is uphill and the hill is your own making. They\'ve already weighed your menace and written down nothing — every word now has to first undo that, then do its own work. It can still be done. But you stripped your own leverage off before you opened your mouth. There is exactly one way through: find GRIT, one flat specific thing, no flourish. He\'s the only one who hasn\'t fully closed the ledger.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'They watched the silence fail — your menace is already priced at zero' },
        ],
      },
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'You know this feeling — the scramble after the strong move didn\'t land, talking faster because the first thing didn\'t work. It almost never works either. Almost. Slow down. Make the almost count.',
      },
    ],
    choices: [
      {
        id: 'recover',
        text: 'Find GRIT. Flat and plain. "The quiet was the courtesy. Here\'s the part without it — you won\'t like what the quiet was keeping back."',
        nextNodeId: 'goblin_talk_close',
      },
    ],
  },

  goblin_threat_success: {
    id: 'goblin_threat_success',
    narrative:
      'You give them one thing. Low, unhurried, flat — the voice of someone reporting a fact they fully expect to repeat. You don\'t raise it; you don\'t have to.\n\n"You came in off the east shaft. There were four of you then." You let that sit a half-beat. "The draft changed an hour ago. You\'ll have felt it. That was me, finishing something three days old. You\'re standing on the last of it."\n\nThen nothing. You don\'t explain it, don\'t soften it, don\'t hand them the fourth thing — you let them build that one themselves, in their own heads, out of their own fear. By the time the silence is done the big one has stopped chewing and the small one has gone the colour of wet ash. You never learn whether a word of it landed as true. It lands as enough.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Grit — Grit, is it telling true? It sounds like true. It\'s got the true-voice, the flat one, the one Mother had when she said the thing about the well—',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It\'s — shut up — it\'s bluffing, it has to be, look at the state of it, it\'s one and there\'s — Grit, tell him it\'s bluffing. Grit. Tell him.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'I\'ve heard that exact flat voice before. On a thing that wasn\'t bluffing. We\'re not staying to learn which one this is. Back. Leave the buckle — the buckle\'s not worth whatever that turns out to be.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'That\'s the whole art, and you just did it clean. Not the lie — the load-bearing detail. You handed them three true-sounding things and let them build the fourth one themselves, in their own heads, out of their own fear. They scared themselves with the thing you only pointed at.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'And you meant some of it. That\'s why it held — the seam they couldn\'t find was the part that wasn\'t a lie. Let them run. Let them carry it.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Let them go. Walk through.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_threat_fail: {
    id: 'goblin_threat_fail',
    narrative:
      'The silence runs out and GRIT is still standing there. He tilts his head, a small, considered movement, the way something moves when it\'s finished thinking and doesn\'t like the answer. He looked at everything you gave him and he weighed it and the scales came up wrong. NIM makes a sound — satisfied and small, the sound of a thing that was right about something and is now collecting on it. They spread wide.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Good talk. Meant some of that, I think. Didn\'t mean enough.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Called it. Called it from the first word. Get it before it remembers it should\'ve run.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'He ran the numbers and came up short. Not by much — you can see the margin in his face. It wasn\'t the story that failed. It was one small thing he couldn\'t quite make fit, some seam he found that you didn\'t know was showing. You\'ll never know which one.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'Fine. They want to see what\'s under the words. Stop talking. Show them what\'s under the words.',
      },
    ],
    choices: [
      { id: 'fight', text: 'The talking\'s done. Do it the hard way.', nextNodeId: 'goblin_cornered' },
    ],
  },

  // ── Bribe conversation ───────────────────────────────────────────────────────
  // Only reachable with the corpse-veil (the 'poison' unlock, consumed on the
  // confront choice — once it's on offer, it's committed). The catch: corpse-
  // veil is poison, so selling it as food is the trap. The two real frames are
  // value (NIM's greed, read via Appraisal) and ward (GRIT's fear of the deep,
  // read via Dungeon Lore). Gated passive reads point you to the right frame and
  // the right way to seal it; a misread routes through goblin_bribe_thin, which
  // applies a size_step_down on Appraisal that travels into the closing check.
  //
  //   goblin_bribe_open
  //     food  → goblin_bribe_food   (trap)  → recover → thin → close
  //                                          → double down → goblin_cornered
  //     value → goblin_bribe_value           → good seal → close
  //                                          → weak seal → thin → close
  //     ward  → goblin_bribe_ward            → good seal → close
  //                                          → weak seal → thin → close
  //   goblin_bribe_close → Appraisal check → goblin_bribe_success / goblin_bribe_fail

  goblin_bribe_open: {
    id: 'goblin_bribe_open',
    narrative:
      'You don\'t reach for a blade. You reach into your coat and come out with the grey handful — corpse-veil, pale and dense, the fungus off the wet wall — and you hold it where the firelight can find it. Three sets of eyes go to it at once. The thing about a gift in the dark is that each thing looking at it wants something different from it, and you can read those wants on their faces if you\'re quick.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Is that — that\'s a mushroom. That\'s food. Grit, it\'s holding food, is it going to — is it for sharing? Is the food for sharing?',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Why\'s it showing us? Things don\'t show you what they\'ve got, not down here, not unless there\'s a hook in it. What\'s the hook? There\'s always a hook in the showing.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Hands where they are. Good. Now tell me why I\'m looking at a fistful of deathcap instead of a fight.',
      },
      {
        kind: 'passive',
        skillKey: 'dungeonLore',
        successInterjection: {
          speaker: 'DUNGEON LORE',
          text: 'Corpse-veil. It only takes where something died and the dying didn\'t finish leaving. The old warrens hang it at their deepest doors — the deep-things won\'t cross a threshold that smells of a kill already claimed. GRIT\'s been watching the dark all night because the dark\'s been wrong. Don\'t offer him a meal. Offer him a ward.',
        },
      },
      {
        kind: 'passive',
        skillKey: 'dangerSense',
        successInterjection: {
          speaker: 'DANGER SENSE',
          text: 'The small one\'s eyes are doing sums on it. He found the buckle — he\'s the one who measures worth, and worth is the lever you have. And do not call it food. The big one will have it down his throat before you finish the sentence, and then there\'s no trade, one dead goblin, and two who watched you do it.',
        },
      },
    ],
    choices: [
      {
        id: 'food',
        text: '(to BOLE) "You\'re starving. Take it — eat well, and we\'ll call it square between us."',
        nextNodeId: 'goblin_bribe_food',
      },
      {
        id: 'value',
        text: '(to NIM) "That buckle you\'re guarding? This is worth ten of it to the right buyer. You\'re the one who knows worth here — look at it properly."',
        nextNodeId: 'goblin_bribe_value',
      },
      {
        id: 'ward',
        text: '(to GRIT) "You said the dark\'s been wrong since sundown. You know what grows where things die — and what it keeps from a fire. That\'s what I\'m putting on the ground. A ward, for one walk past your passage."',
        nextNodeId: 'goblin_bribe_ward',
      },
    ],
  },

  goblin_bribe_food: {
    id: 'goblin_bribe_food',
    narrative:
      'BOLE is moving before you finish the word — a lunge of pure want — and NIM\'s arm slaps flat across his chest and stops him dead. NIM\'s eyes have gone to slits. Nobody gives food away in a hole like this. He knows that in his teeth, and you\'ve just made him stand there and wonder why you\'d break the rule.',
    beats: [
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'Nim — Nim, let go, it SAID, it said I could, it said eat well—',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It said. It said. Things that hand you food in the dark, Bole — you know what wants you slow and full and not looking. What\'s in it? What. Is. In. It?',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: '...That\'s the right question, actually. What is in it?',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'He is two words from the truth, and the truth is poison. You can\'t sell a meal now — they\'ve stopped seeing food and started seeing a method. The only road left is to make it worth something other than eating, and to do it before NIM finishes the sentence he\'s building.',
      },
    ],
    choices: [
      {
        id: 'recover',
        text: '(to NIM, fast) "Nothing\'s in it that touches you — because you\'re not going to eat it. You\'re going to sell it. Forget his stomach. Use your eyes."',
        nextNodeId: 'goblin_bribe_thin',
      },
      {
        id: 'double_down',
        text: '(to BOLE) "It\'s just a mushroom. Go on — take it—"',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_bribe_value: {
    id: 'goblin_bribe_value',
    narrative:
      'NIM doesn\'t take it. But he doesn\'t look away from it either, and the not-looking-away is the whole game. He\'s weighing it the way he weighed the buckle, the way he weighs everything — worth set against the trouble of getting it. Greed and suspicion in the same squint. You have to feed the one without feeding the other.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Worth ten of it. Worth ten of it, says the cornered thing, with no reason in the world to lie to us. If it\'s worth so much, why\'s it in your hand and not down your own coat? Why\'s it for giving?',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'He\'s got you there. Generous, you. Suspiciously generous, for a thing with its back to my fire.',
      },
      {
        kind: 'passive',
        skillKey: 'appraisal',
        successInterjection: {
          speaker: 'APPRAISAL',
          text: 'The price isn\'t the con — it really is worth more than the buckle, and he half-believes that already. The con is the giving. Don\'t defend the value; explain the parting. Give him the one reason a desperate thing hands over treasure: because the thing it buys is worth more than treasure. He\'d make that trade himself, and he knows it.',
        },
      },
    ],
    choices: [
      {
        id: 'seal_good',
        text: '(to NIM) "Because I can\'t spend it dead. Passage out is worth more to me than coin I won\'t live to carry. You\'d make the same trade — you know you would."',
        nextNodeId: 'goblin_bribe_close',
      },
      {
        id: 'seal_weak',
        text: '(to NIM) "Does it matter why? It\'s yours. Just let me by and it\'s yours, no hook, no catch."',
        nextNodeId: 'goblin_bribe_thin',
      },
    ],
  },

  goblin_bribe_ward: {
    id: 'goblin_bribe_ward',
    narrative:
      'GRIT looks at the fungus, and then past his own fire at the dark he\'s been watching all night, and you see the two thoughts touch. He is a thing that has stayed alive by taking threats seriously. The only question is whether he takes this one seriously enough to deal — or decides you\'re playing back the exact fear he\'s already carrying, which is its own kind of insult.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'A ward. You\'re telling me that\'s a ward. And you happen to have one, and you happen to offer it the one night the dark\'s gone wrong. Convenient thing, you.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It\'s lying, Grit. It heard you fret about the dark and now it\'s selling the fret back to you at a markup—',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...but what if it\'s not, though? Nim. What if it\'s a real ward and we said no and then the dark comes?',
      },
      {
        kind: 'passive',
        skillKey: 'dungeonLore',
        successInterjection: {
          speaker: 'DUNGEON LORE',
          text: 'BOLE just planted the doubt for you. Now make it specific or it withers as mysticism. Don\'t say "it protects." Say the mechanism: hung at the threshold, reeking of a death already taken, the deep-things read it as another predator\'s kill and turn aside rather than challenge the claim. Specific fear is the only kind GRIT pays for. The vague kind he already owns.',
        },
      },
    ],
    choices: [
      {
        id: 'seal_good',
        text: '(to GRIT) "Hang it at your deepest door. Whatever climbs up out of the dark reads the smell as a kill already claimed — another predator\'s mark — and turns aside rather than challenge it. You don\'t need it forever. You need it tonight."',
        nextNodeId: 'goblin_bribe_close',
      },
      {
        id: 'seal_weak',
        text: '(to GRIT) "It protects. That\'s all you need — it keeps the dark off your fire. Take my word."',
        nextNodeId: 'goblin_bribe_thin',
      },
    ],
  },

  goblin_bribe_thin: {
    id: 'goblin_bribe_thin',
    narrative:
      'It goes thin. Whatever you said didn\'t have enough weight under it, and they feel the lack the way you feel a coin lighter than it ought to be. The deal isn\'t dead. But it\'s wounded now, and they can smell that the same way they smelled the rest.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'There. There — you felt that, Grit? The bottom of it. There\'s no bottom to the thing. It\'s air all the way down.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Maybe. Maybe a thin true thing\'s still true. ...Maybe. Finish it, then. Last of it, and quick — I\'m nearly decided.',
      },
      {
        kind: 'voice',
        speaker: 'APPRAISAL',
        text: 'You let the price wobble, and a wobbling price is a false one — every trader knows it in their teeth. Steady it. Name the number plain and don\'t flinch off it. Flinching now reads exactly like admitting the whole thing was air.',
        penalties: [
          { type: 'size_step_down', skillKey: 'appraisal', sourceDescription: 'Let the price wobble — they can smell the doubt now' },
        ],
      },
    ],
    choices: [
      {
        id: 'steady',
        text: '(steady, flat, no flinch) "One walk past your fire. That\'s the whole price. Take it, or spend the night wondering what you turned down."',
        nextNodeId: 'goblin_bribe_close',
      },
    ],
  },

  goblin_bribe_close: {
    id: 'goblin_bribe_close',
    narrative:
      'You set it on the ground between you — grey against the stone — and the offer with it. GRIT looks at it. NIM looks at GRIT. BOLE looks at the mushroom like it\'s the only thing in the chamber. The fire ticks down a notch. This is the seam of it: the breath where a price becomes a deal or becomes an insult, and the only one who gets to say which is the one who hasn\'t spoken yet.',
    beats: [
      {
        kind: 'voice',
        speaker: 'APPRAISAL',
        text: 'You\'ve set the price. Don\'t sweeten it, don\'t explain it twice — a price explained twice is one the seller doesn\'t believe. Let it sit on the stone and be worth exactly what you said.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Hands loose. Whichever way he goes, the first half-second after is the one that counts. Be ready to walk or ready to move — not both, not halfway.',
      },
    ],
    choices: [
      {
        id: 'wait',
        text: 'Let the price sit on the stone. Wait.',
        nextNodeId: 'goblin_bribe_success',
        check: { skillKey: 'appraisal', failNodeId: 'goblin_bribe_fail' },
      },
    ],
  },

  goblin_bribe_success: {
    id: 'goblin_bribe_success',
    narrative:
      'GRIT crouches. He doesn\'t pick it up — he nudges it with two knuckles, turning it over, reading it the way you\'d read a coin for the bite of false metal. Then he stands, steps back one deliberate pace, and the gap by the passage opens like a held breath let go. He never says you can pass. He just stops being in the way, which from a thing like GRIT is the same as a signature.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Bole. Pick it up careful, by the stem, and don\'t you dare put it near your mouth — it goes on the deep door, like the thing said. ...Go on, long one. Walk. We\'re square. Don\'t come back through; the deal was for the once.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: '...and if that ward\'s a lie I\'ll have called it, I\'ll have called it twice, and nobody — nobody ever — lets me have the calling—',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'It shared, though. In the end. Sort of. I\'m counting it as shared.',
      },
      {
        kind: 'voice',
        speaker: 'APPRAISAL',
        text: 'Clean. You sold a poison as a promise and walked out on the strength of the telling alone. Don\'t look pleased on the way past — a deal admired is a deal reconsidered. Walk like you\'d have paid double and thought it cheap.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Step past the fire and go, before he reconsiders.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_bribe_fail: {
    id: 'goblin_bribe_fail',
    narrative:
      'GRIT crouches, nudges it with two knuckles, turns it over — and something in the turning doesn\'t satisfy him. Maybe the price never steadied. Maybe he\'s simply a thing that has lived this long by saying no to convenient gifts. He stands without picking it up, and the not-picking-up is the whole of the answer.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'No. I don\'t think so. Nice telling — but I\'ve bought nice tellings before and paid for them in blood. A thing that bargains this hard for a walk is a thing the walk\'s worth too much to. Which means it\'s worth something to keep you off it. Nim was right. Nim\'s usually right; it\'s why I keep him.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'I\'m USUALLY RIGHT. Bole — Bole, did you hear it, he said it with his mouth, out loud, in front of—',
      },
      {
        kind: 'voice',
        speaker: 'APPRAISAL',
        text: 'He didn\'t buy it. Worse — he read the hardness of the sell as the size of the prize, and now the passage is the one thing he won\'t part with. Nothing left on the table but what was always under the words.',
      },
      {
        kind: 'voice',
        speaker: 'SPITE',
        text: 'The deal\'s dead and the dark\'s still at their backs, not yours. Nothing for it now but the old arithmetic. Make the wanting cost them something.',
      },
    ],
    choices: [
      { id: 'fight', text: '"Have it your way." Set your feet.', nextNodeId: 'goblin_cornered' },
    ],
  },

  // ── Divide path ─────────────────────────────────────────────────────────────
  // The buckle dispute between NIM and BOLE was already live when Fiodor arrived.
  // The correct play: ask one pointed question about ownership, then step back and
  // let the existing fault run on its own. You don't have to win the argument.
  // You need it to run long enough for you to no longer be in it.
  //
  // Misreads and wrong moves:
  //   - Target GRIT's exhaustion: he answers honestly (he IS tired), but NIM
  //     notices you working him → size_step_down on Deception
  //   - Target BOLE directly: NIM intercepts and names the tactic before you
  //     finish the sentence → double penalty; can redirect, but with damage
  //   - Push the ownership point too explicitly: NIM catches the con mid-sentence,
  //     "it's doing it, it's trying to turn us" → goblin_cornered
  //
  //   goblin_divide_open
  //     → goblin_divide_nim_claim     (right read: ask about ownership)
  //         → goblin_divide_wedge     (right: step back, let it run)
  //             → goblin_divide_close → Deception → success / cornered
  //         → goblin_divide_push      (wrong: name the spot too explicitly)
  //             → goblin_cornered
  //     → goblin_divide_grit          (risky: target GRIT's weariness)
  //         → goblin_divide_close     (NIM noticed — penalty already applied)
  //     → goblin_divide_bole_direct   (wrong target — NIM named it)
  //         → goblin_divide_nim_claim (redirect; penalties carry)
  //         → goblin_cornered

  goblin_divide_open: {
    id: 'goblin_divide_open',
    narrative:
      'You have the floor. The argument about the bright thing stopped when you stepped into the firelight, but it didn\'t go away — you can still see it on their faces, the exact shape of a dispute interrupted mid-breath. BOLE keeps glancing at NIM\'s hand. NIM keeps not looking at BOLE.',
    beats: [
      {
        kind: 'passive',
        skillKey: 'dungeonLore',
        successInterjection: {
          speaker: 'DUNGEON LORE',
          text: 'That buckle is corroded brass. Whatever NIM thinks it\'s worth, it isn\'t — any real buyer would see it before the handshake was dry. But that\'s not why it matters. It matters because they found it together and only one of them got to say mine. The value is incidental. The principle has teeth.',
        },
      },
      {
        kind: 'passive',
        skillKey: 'dangerSense',
        successInterjection: {
          speaker: 'DANGER SENSE',
          text: 'NIM is tracking you. Not his hands — his eyes, the small careful movements of something that recognises when it\'s being read. The existing fault is the only lever you have in this room. Let it do the work. Go slow. Don\'t reach for it until you\'re already gone.',
        },
      },
    ],
    choices: [
      {
        id: 'ask_who',
        text: '"That thing you\'re arguing about — I heard you from the dark. Who found it first?"',
        nextNodeId: 'goblin_divide_nim_claim',
      },
      {
        id: 'ask_grit',
        text: '(to GRIT, quiet) "How long have you been settling their arguments?"',
        nextNodeId: 'goblin_divide_grit',
      },
      {
        id: 'bole_first',
        text: '(to BOLE) "You found the spot before he had his hand in it, didn\'t you."',
        nextNodeId: 'goblin_divide_bole_direct',
      },
      {
        id: 'deflate',
        text: '"That thing you\'re arguing over — I know what it is. Corroded brass. Worth nothing to any buyer who knows what they\'re looking at."',
        nextNodeId: 'goblin_divide_deflate',
      },
    ],
  },

  goblin_divide_nim_claim: {
    id: 'goblin_divide_nim_claim',
    narrative:
      'NIM\'s hand closes on the buckle. His eyes go sharp in the specific way of something that\'s been asked a question it\'s been waiting all night to be asked — and is now suspicious about the waiting.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'What\'s it to you. What does it MATTER to you who found it — you\'re not here for the buckle. Unless you are. Are you here for the buckle?',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...I found the spot. That\'s all I ever said. The spot. It doesn\'t — it\'s fine, Nim. Never mind.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'It matters.',
      },
      {
        kind: 'passive',
        skillKey: 'dungeonLore',
        successInterjection: {
          speaker: 'DUNGEON LORE',
          text: 'NIM just answered his own question. He\'s so busy defending the ownership that he\'s stopped clocking you. The dispute has the room. You\'re background noise now.',
        },
      },
    ],
    choices: [
      {
        id: 'step_back',
        text: 'Step back. Don\'t add another word. Let it run.',
        nextNodeId: 'goblin_divide_wedge',
      },
      {
        id: 'push',
        text: '(to NIM) "He found the spot before your hand was in it, though. That\'s half the work."',
        nextNodeId: 'goblin_divide_push',
      },
      {
        id: 'arbitrate',
        text: '(to GRIT) "What do you think — finder\'s spot, or finder\'s hand?"',
        nextNodeId: 'goblin_divide_grit_arbitrate',
      },
    ],
  },

  goblin_divide_wedge: {
    id: 'goblin_divide_wedge',
    narrative:
      'You say nothing. The absence of another word lands in the middle of the room and the room fills it in the only way a room like this can.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: '...Don\'t look at me like that, Bole.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'I\'m not looking at you like anything.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'You\'re doing the look. I know the look — you\'ve been doing the look since the crag, every time something comes up that you think you should\'ve—',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'I found the spot.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'There it is. One question and the question grew legs on its own. GRIT is watching you now — not them — with the expression of something that has just realised it\'s being managed. He\'s not angry yet. That\'s the window.',
      },
    ],
    choices: [
      {
        id: 'go',
        text: 'Step back toward the passage. Let them finish without you.',
        nextNodeId: 'goblin_divide_close',
      },
      {
        id: 'nudge',
        text: '(to NIM, quiet) "He\'s been carrying that since before the buckle, hasn\'t he."',
        nextNodeId: 'goblin_divide_overreach',
      },
    ],
  },

  goblin_divide_grit: {
    id: 'goblin_divide_grit',
    narrative:
      'GRIT goes still. Not the pacing-still — this is different, the still of something that was asked a real question in a room that doesn\'t usually contain real questions.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: '...Most nights, yes. One of them finds something. The other says he found it first. I stand between them until they get tired of it. Same fire, different object.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Grit—',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'I\'m just answering.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'GRIT told you something honest. He answered instead of dismissing, which means he\'s more tired than he lets on. The problem is NIM heard it, and NIM is now looking at you the way a sharp thing looks at something it almost didn\'t catch.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'NIM flagged you working GRIT — he\'s watching the seams now' },
        ],
      },
    ],
    choices: [
      {
        id: 'cost',
        text: '(to GRIT) "The only question left is whether tonight costs more than it has to."',
        nextNodeId: 'goblin_divide_close',
      },
    ],
  },

  goblin_divide_bole_direct: {
    id: 'goblin_divide_bole_direct',
    narrative:
      'NIM is between you and BOLE before you finish the sentence. Of course he is.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'No. BOLE — eyes on me, not on it. It\'s trying to use you as a wedge. Everyone tries the big soft one first. I\'ve seen it. I\'ve seen it every time.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'He\'s not wrong.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: '...oh. Was it doing that?',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'NIM has a complete catalogue of these moves and he named this one in under two seconds. GRIT agreed. BOLE is now looking at you like you\'ve been impolite. You\'ve shown your hand to the one person whose whole job is watching for hands.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'NIM named the tactic — GRIT confirmed it, the room read you' },
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'The room briefly unified against you' },
        ],
      },
    ],
    choices: [
      {
        id: 'redirect',
        text: 'Ask the right question instead. "You\'re right. I\'ll try again — who found it first?"',
        nextNodeId: 'goblin_divide_nim_claim',
      },
      {
        id: 'fight',
        text: 'That\'s done. Set your feet.',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_divide_push: {
    id: 'goblin_divide_push',
    narrative:
      'NIM\'s face closes. The arguing-face goes away and the watchful-face comes back, very quickly, and you see him file what just happened.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Oh. Oh, it\'s doing it. Grit — it\'s trying to turn us on each other. It came in here and — I\'ve SEEN this. I know exactly what this is.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Yeah.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'That\'s what the whole question was FOR. The "who found it" — that was setup. It was setup for THIS.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'He had it the moment you named the specifics. NIM is a con himself — or he\'s been the target enough to know the shape. One word too far and he found the seam. The whole room is watching you with the same face now.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'NIM caught the con mid-sentence — the room unified' },
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Every one of them is now watching you the same way' },
        ],
      },
    ],
    choices: [
      {
        id: 'cornered',
        text: 'That\'s done.',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_divide_close: {
    id: 'goblin_divide_close',
    narrative:
      'They\'re at it now — the real argument, the one that was already alive before you arrived, about who finds things and who gets to have them and what the difference is between a spot and a hand. GRIT is standing with his back to you, watching them, doing the specific thousand-yard stare of something that has been doing this for a very long time. The passage is six feet behind you.',
    beats: [
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'Go. Don\'t reach for the ending — you don\'t need to win the argument. You need it to run long enough for you to no longer be in it. The step you\'re about to take is the only move left.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'GRIT isn\'t watching the passage. He\'s watching them. Move.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: '...',
      },
    ],
    choices: [
      {
        id: 'keep_walking',
        text: 'Hold his gaze. Keep walking.',
        nextNodeId: 'goblin_divide_success',
        check: { skillKey: 'deception', failNodeId: 'goblin_cornered' },
      },
      {
        id: 'nod',
        text: 'Nod to him. Just once.',
        nextNodeId: 'goblin_divide_grit_nod',
      },
      {
        id: 'look_away',
        text: 'Look away before he catches your eye.',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_divide_success: {
    id: 'goblin_divide_success',
    narrative:
      'You back into the passage two steps, then three, and nobody stops you. NIM has his hands going. BOLE has gone the deep stubborn colour of an argument he\'s been sitting on for months. GRIT stands between them with the bearing of a mountain deciding not to move, and he lets you go — not because he doesn\'t notice, but because the room needs him more than the passage does tonight. From somewhere behind you, already muffled by stone, you hear him say something short.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'THE HAND. THE PULLING. The pulling is the whole—',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'I found the SPOT, Nim. The spot comes before the hand. The spot is what makes a hand possible—',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: '...Smart.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You didn\'t win the argument. You walked away from it while it was still running. That\'s the whole art of this particular thing — a well-placed question answers itself, in absentia, in someone else\'s voice. You were already gone when it finished.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Don\'t look back. Press on.', nextNodeId: 'goblin_exit' },
    ],
  },

  goblin_divide_deflate: {
    id: 'goblin_divide_deflate',
    narrative:
      'The argument dies. Both of them look at you. GRIT doesn\'t move. You have just done the room the specific disservice of telling two people that the thing they\'ve been fighting over is worthless, in front of their keeper, in what was about to be a negotiation.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: '...What\'s it to you what it\'s WORTH. It\'s mine. The worth of it isn\'t the — who asked you. Who asked you what it\'s worth.',
      },
      {
        kind: 'voice',
        speaker: 'BOLE',
        external: true,
        text: 'It\'s pretty, though. I like the way it catches the fire.',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'Hm. Now they\'ve got something in common.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You killed the dispute. Good reading, terrible application — the argument was the only lever in the room and you told them both they were wrong to have it. Without the argument, the only thing left in the room is you.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Dismantled the dispute\'s premise — removed the only lever' },
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'Three goblins briefly aligned against the common problem' },
        ],
      },
    ],
    choices: [
      {
        id: 'cornered',
        text: 'That went wrong.',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_divide_grit_arbitrate: {
    id: 'goblin_divide_grit_arbitrate',
    narrative:
      'GRIT looks at you. Not at them. At you. And then, slowly, at NIM. And NIM\'s expression does something small and satisfied.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'I think you\'re asking me to take a side because you\'d find it useful.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'THERE. That\'s the move — it wants Grit invested, it wants Grit to rule on it so Grit has skin in the outcome now—',
      },
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'I know, Nim.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You pulled the one person with no stake in the dispute into the dispute, and NIM named the mechanism before GRIT finished answering. All three of them now have a cleaner picture of what you\'re doing than you\'d like. And GRIT is the one who feels used.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Made the manipulation visible to GRIT — he identified it himself' },
          { type: 'size_step_down', skillKey: 'endurance', sourceDescription: 'The room read the play and closed' },
        ],
      },
    ],
    choices: [
      {
        id: 'cornered',
        text: 'That\'s done.',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_divide_overreach: {
    id: 'goblin_divide_overreach',
    narrative:
      'The word lands. NIM goes quiet — the good kind of quiet, from your perspective — for about two seconds. Then his head turns.',
    beats: [
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: '...It\'s still doing it. It\'s STILL — Grit. It\'s still here. It\'s still talking. Why is it still talking.',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'You reached for one more word and the reaching is what he saw. The argument was running. You were background noise. The moment you spoke you came back into focus, and NIM\'s whole job is to notice things that come back into focus.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'One word too many — came back into focus while the argument was already running' },
        ],
      },
    ],
    choices: [
      {
        id: 'close',
        text: 'Stop. Back toward the passage.',
        nextNodeId: 'goblin_divide_close',
      },
      {
        id: 'cornered',
        text: 'Too late for that.',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },

  goblin_divide_grit_nod: {
    id: 'goblin_divide_grit_nod',
    narrative:
      'GRIT\'s expression doesn\'t change. Then he raises his voice, just slightly. NIM hears it.',
    beats: [
      {
        kind: 'voice',
        speaker: 'GRIT',
        external: true,
        text: 'You. Wait.',
      },
      {
        kind: 'voice',
        speaker: 'NIM',
        external: true,
        text: 'Oh, NOW it\'s waiting. Now it\'s — Grit, are we doing something with it? Are we holding it?',
      },
      {
        kind: 'voice',
        speaker: 'DECEPTION',
        text: 'GRIT was going to let you through. He\'d already decided. The nod made it a transaction, and GRIT doesn\'t want to be in your transaction — he wanted to have let you go without being owed anything for it. Now he has to make a decision in front of NIM, and the decision in front of NIM is always the same one.',
        penalties: [
          { type: 'size_step_down', skillKey: 'deception', sourceDescription: 'Made the silent agreement visible — forced GRIT to acknowledge it in front of NIM' },
        ],
      },
    ],
    choices: [
      {
        id: 'cornered',
        text: 'He was going to let you through.',
        nextNodeId: 'goblin_cornered',
      },
    ],
  },
}
