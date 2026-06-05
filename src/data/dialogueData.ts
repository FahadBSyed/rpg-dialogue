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
export interface VoiceBeat {
  kind: 'voice'
  id?: string
  speaker: string
  text: string
  penalties?: Array<{ type: PenaltyType; skillKey?: SkillKey; lockKey?: string; sourceDescription: string }>
}

export interface PassiveBeat {
  kind: 'passive'
  id?: string
  skillKey: SkillKey
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

export const dialogueNodes: Record<string, DialogueNode> = {
  goblin_start: {
    id: 'goblin_start',
    narrative:
      'The tunnel opens into a low chamber and you stop before your boot finds the light. Three goblins. A cookfire, something on a spit above it that you decide not to identify, a scatter of bones and dented tin. Two of them crouch arguing over a small bright thing. The third paces the far edge of the firelight — back and forth, past the second passage. The passage you need. None of them have seen you. Not yet.',
    beats: [
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

  goblin_approach: {
    id: 'goblin_approach',
    narrative: 'The chamber is laid out below you. Three goblins, a cookfire, the passage you need. They still haven\'t seen you.',
    beats: [],
    choices: [
      {
        id: 'sneak',
        text: 'Wait for the gap in his circuit, then move.',
        nextNodeId: 'goblin_slip',
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
        id: 'terrify',
        text: 'Step into the firelight. All the way. Make them look at what\'s walking toward them.',
        nextNodeId: 'goblin_terrify_success',
        check: { skillKey: 'reputation', failNodeId: 'goblin_terrify_fail' },
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

  goblin_slip: {
    id: 'goblin_slip',
    narrative:
      'You move when the pacing goblin turns for the wall. Three steps and you fold into the shadow of the rubble pile, one breath held against the stone. The arguing pair never look up. When he turns again you take the last of the open floor in a low, even glide and press yourself into the mouth of the far passage, back flat against cold stone. The fire is three seconds behind you. The chamber is still. None of them have looked up.',
    beats: [
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
      { id: 'continue', text: 'Press on. Leave them to it.', nextNodeId: 'goblin_start' },
      {
        id: 'poison',
        text: 'Go back. The fire is right there — they\'ll never know you were behind them.',
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
        text: 'Slow hands. Natural hands. Nothing furtive — furtive is what gets seen. You belonged at that fire for exactly as long as you needed to belong there, and not one breath more. That is the whole art of it.',
      },
      {
        kind: 'voice',
        speaker: 'DANGER SENSE',
        text: 'Don\'t stay to watch it work. Watching is for people who want to be remembered. Walk.',
      },
      {
        kind: 'voice',
        speaker: 'HUNGER',
        text: 'It did smell good. I want it on record that some part of me is sorry about the waste. Only some part.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Leave them to it. Press on.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_poison_caught: {
    id: 'goblin_poison_caught',
    narrative:
      'Your hand is in the meat when the pacing goblin\'s circuit comes up short. He sees the grey dust on your fingers before he sees your face, and there is no version of this that reads as anything but exactly what it is. He shrieks — not fear, outrage — and the other two are already up. You are crouched at their fire with your hand in their dinner and nowhere good to be.',
    beats: [
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
      { id: 'continue', text: 'Catch your breath, then go on.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_cornered: {
    id: 'goblin_cornered',
    narrative:
      'The gap closes. Three of them, blades out, cutting off every angle — the passage, the fire, the rubble pile. They move like they\'ve done this before, patient and unhurried. You\'ve seen this shape from the other side. The fire is at your back.',
    beats: [
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
      { id: 'last_stand', text: 'Set your back to the fire and make them pay for it.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_run_cornered: {
    id: 'goblin_run_cornered',
    narrative:
      'Your legs don\'t have it. The old knee buckles two strides in and the gap closes ahead of you. A goblin slides between you and the passage, blade held low, grinning the way small things grin when they\'ve suddenly become the larger problem. The other two fan out behind. The fire is at your back now. There is no more running to do.',
    beats: [
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
      { id: 'last_stand', text: 'Set your back to the fire and make them pay for it.', nextNodeId: 'goblin_start' },
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
        check: { skillKey: 'endurance', failNodeId: 'goblin_cornered_two' },
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
      { id: 'continue', text: 'Step over them and press on.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_fight_two_won: {
    id: 'goblin_fight_two_won',
    narrative:
      'Two more, after the first. They came in together and it was ugly and close, and at some point it stopped being a fight and became something you just had to outlast. When it ends you are still upright. Barely. The chamber is quiet. Three goblins down, each by a different method, none of them clean.',
    beats: [
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
      { id: 'continue', text: 'Catch your breath. Then go.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_fight_two_won_whip: {
    id: 'goblin_fight_two_won_whip',
    narrative:
      'The whip keeps them honest. One crack and they back off a step — enough to breathe, to reset, to pick the opening. It\'s still ugly. But you had reach and they didn\'t, and when the chamber goes quiet there are two more down and the whip is still in your hand.',
    beats: [
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
      { id: 'continue', text: 'Coil the whip and press on.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_cornered_two: {
    id: 'goblin_cornered_two',
    narrative:
      'You don\'t make it. Two of them, not three — but they watched you put the first one down and they\'ve adjusted. No grinning. No posturing. They spread wide and come in low, blades out, making themselves expensive. This is a fair fight by dungeon standards, which means it\'s still bad.',
    beats: [
      {
        kind: 'voice',
        speaker: 'SCARRING',
        text: 'Different from three. You\'ve done worse than this and walked out. The math is better — use that.',
      },
      {
        kind: 'voice',
        speaker: 'ENDURANCE',
        text: 'Plant. Stop retreating. Every step back is a step they don\'t have to take. Set your weight and make them come to you.',
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
        check: { skillKey: 'endurance', failNodeId: 'goblin_start' },
      },
    ],
  },

  // ── Terrify path ─────────────────────────────────────────────────────────────

  goblin_terrify_success: {
    id: 'goblin_terrify_success',
    narrative:
      'You step out of the dark and into the firelight. Upright, unhurried, the way something walks when it expects to be the most dangerous thing in the room. The pacing goblin stops mid-circuit. The arguing pair look up. The bright thing drops, forgotten. Something registers — maybe the name, maybe the posture, maybe the fact that you don\'t look like someone who expects to lose. One of them breaks first. Then the other two follow. The chamber empties toward the far passage in a shrieking scatter. The pacing one is last. He looks back once. You hold his gaze. He goes.',
    beats: [
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
        speaker: 'REPUTATION',
        text: 'They knew. Maybe not the name — the shape of the thing. You\'ve made yourself into something that registers down here. That was the work of a long time. It just paid out.',
      },
    ],
    choices: [
      { id: 'continue', text: 'Walk through.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_terrify_fail: {
    id: 'goblin_terrify_fail',
    narrative:
      'You step out of the dark and into the firelight. Upright, unhurried. The pacing goblin stops. The arguing pair look up. For a moment the chamber holds its breath — and then it doesn\'t. They don\'t break. The pacing one takes a step toward you. The arguing pair close together and then spread apart in a practiced way that says: this isn\'t the first time something bigger walked in and tried this. One of them grins. It\'s the kind of grin that lives in dungeons because everything that wore it survived long enough to grow teeth.',
    beats: [
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
      { id: 'fight', text: 'Then we do it the hard way.', nextNodeId: 'goblin_cornered' },
    ],
  },
}
