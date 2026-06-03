import type { SkillKey, BonusType } from '../store/gameStore'

export interface DialogueChoice {
  text: string
  nextNodeId: string
  check?: { skillKey: SkillKey; failNodeId?: string }
  // Only shown when a matching `unlock_choice` bonus is currently pending.
  requiresUnlock?: string
}

export interface Interjection {
  speaker: string
  text: string
}

export interface PassiveCheckDef {
  skillKey: SkillKey
  successInterjection?: Interjection
  successBonus?: { type: BonusType; skillKey?: SkillKey; unlockKey?: string; sourceDescription: string }
}

export interface DialogueNode {
  id: string
  narrative: string
  passiveChecks?: PassiveCheckDef[]
  interjections: Interjection[]
  choices: DialogueChoice[]
}

// ── The Goblin Chamber ──────────────────────────────────────────────────────
// Scenario: three goblins between Fiodor and the passage onward.
// PASS 1 — the default path: sneaking past.
// Later passes will add: poison, ambush, terrify, trick, lure-a-monster,
// lure-into-trap, and the various talking gambits, branching from `goblin_start`.

export const dialogueNodes: Record<string, DialogueNode> = {
  goblin_start: {
    id: 'goblin_start',
    passiveChecks: [
      // Supporting skill (Wayfinding) maps the room and, on success, sets up
      // the primary skill (Danger Sense) for the sneak — a size step-up bonus.
      {
        skillKey: 'wayfinding',
        successInterjection: {
          speaker: 'WAYFINDING',
          text: 'The room is three steps and a shadow. The pacing one walks a circuit — fire, wall, passage, back. Eleven seconds, give or take. There is a dead angle behind the rubble pile, left of centre, where none of the three can see at once. Wait in the dark. Move on the turn. Stand in that angle and let the circuit close around nothing.',
        },
        successBonus: {
          type: 'size_step_up',
          skillKey: 'dangerSense',
          sourceDescription: 'Wayfinding mapped the gap',
        },
      },
      // Scavenging spots something poisonous in reach. On success it unlocks
      // the "poison their food" approach (an unlock_choice bonus).
      {
        skillKey: 'scavenging',
        successInterjection: {
          speaker: 'SCAVENGING',
          text: 'There — the pale fungus clustered on the damp wall behind the rubble. Corpse-veil. It only grows where something died and it keeps a little of whatever did the killing. A crushed handful worked into something they\'re about to eat would be more than enough. Waste not.',
        },
        successBonus: {
          type: 'unlock_choice',
          unlockKey: 'poison',
          sourceDescription: 'Scavenging found corpse-veil',
        },
      },
    ],
    narrative:
      'The tunnel opens into a low chamber and you stop before your boot finds the light. Three goblins. A cookfire, something on a spit above it that you decide not to identify, a scatter of bones and dented tin. Two of them crouch arguing over a small bright thing. The third paces the far edge of the firelight — back and forth, past the second passage. The passage you need. None of them have seen you. Not yet.',
    interjections: [
      {
        speaker: 'DANGER SENSE',
        text: 'Three. Don\'t count them again — you\'ve counted them. The pacing one is the only one that matters. The other two are noise. Watch his feet. Not his hands. His feet tell you where he\'s about to not be looking.',
      },
      {
        speaker: 'WAYFINDING',
        text: 'Twelve feet of open floor between you and the far passage, broken at the midpoint by a pile of rubble. The fire sits to the right of the line you\'d walk. Keep left of it and the light never reaches you.',
      },
      {
        speaker: 'SCARRING',
        text: 'You\'ve crept past worse than this. The trick is forgetting you have a body — no breath, no weight, no old knee that clicks at the wrong moment. Leave the body here at the threshold. You can come back for it once you\'re across.',
      },
    ],
    choices: [
      {
        text: 'Wait for the gap in his circuit, then move.',
        nextNodeId: 'goblin_slip',
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_spotted' },
      },
      {
        text: 'Creep to the cookfire and work the corpse-veil into the meat.',
        nextNodeId: 'goblin_poison_success',
        check: { skillKey: 'deception', failNodeId: 'goblin_poison_caught' },
        requiresUnlock: 'poison',
      },
      {
        text: 'Stay in the dark and study them a while longer.',
        nextNodeId: 'goblin_observe',
      },
    ],
  },

  goblin_observe: {
    id: 'goblin_observe',
    narrative:
      'You hold still and let the chamber teach you. The argument is about the bright thing — a buckle, maybe, or a coin. The pacing one isn\'t guarding anything; he\'s just the kind that can\'t sit. His circuit never changes. Fire, wall, passage, back. The longer you watch, the more the room feels less like a den and more like a clock.',
    interjections: [
      {
        speaker: 'DANGER SENSE',
        text: 'Now you\'re overstaying. Knowing the pattern is worth something. Standing here memorising it past the point of use is worth getting caught. The next turn he makes — that one\'s yours. Don\'t wait for the one after.',
      },
      {
        speaker: 'HUNGER',
        text: 'That smells edible, actually. The spit. To you, I mean. Not just to them. I\'m only mentioning it. I\'ll stop.',
      },
    ],
    choices: [
      {
        text: 'Enough watching. Move on the next turn.',
        nextNodeId: 'goblin_slip',
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_spotted' },
      },
      {
        text: 'Creep to the cookfire and work the corpse-veil into the meat.',
        nextNodeId: 'goblin_poison_success',
        check: { skillKey: 'deception', failNodeId: 'goblin_poison_caught' },
        requiresUnlock: 'poison',
      },
    ],
  },

  goblin_slip: {
    id: 'goblin_slip',
    narrative:
      'You move when the pacing goblin turns for the wall. Three steps and you fold into the shadow of the rubble pile, one breath held against the stone. The arguing pair never look up. When he turns again you take the last of the open floor in a low, even glide and slip into the dark of the far passage. Behind you the fire crackles, the argument goes on, and not one of the three will ever know you passed through their house.',
    interjections: [
      {
        speaker: 'DANGER SENSE',
        text: 'Good. Now keep moving. Put a corner between you and them before you let yourself feel anything about it.',
      },
      {
        speaker: 'SCARRING',
        text: 'There. You can take the body back now. The knee can complain all it likes — quietly, and a long way from here.',
      },
    ],
    choices: [
      { text: 'Press on into the dark.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_poison_success: {
    id: 'goblin_poison_success',
    narrative:
      'You wait for the pacing one to turn, then cross low to the edge of the fire. The corpse-veil crumbles to a grey dust between your fingers and you press it into the underside of the meat, where char hides the colour. Three breaths and it\'s done. You\'re back in the dark before the circuit comes around. Behind you the argument breaks — someone is hungry. They haul the spit from the flame and tear into it, and you walk past the mouth of their chamber while they eat the thing that is going to kill them.',
    interjections: [
      {
        speaker: 'DECEPTION',
        text: 'Slow hands. Natural hands. Nothing furtive — furtive is what gets seen. You belonged at that fire for exactly as long as you needed to belong there, and not one breath more. That is the whole art of it.',
      },
      {
        speaker: 'DANGER SENSE',
        text: 'Don\'t stay to watch it work. Watching is for people who want to be remembered. Walk.',
      },
      {
        speaker: 'HUNGER',
        text: 'It did smell good. I want it on record that some part of me is sorry about the waste. Only some part.',
      },
    ],
    choices: [
      { text: 'Leave them to it. Press on.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_poison_caught: {
    id: 'goblin_poison_caught',
    narrative:
      'Your hand is in the meat when the pacing goblin\'s circuit comes up short. He sees the grey dust on your fingers before he sees your face, and there is no version of this that reads as anything but exactly what it is. He shrieks — not fear, outrage — and the other two are already up. You are crouched at their fire with your hand in their dinner and nowhere good to be.',
    interjections: [
      {
        speaker: 'DECEPTION',
        text: 'No lie covers this. Don\'t reach for one — a bad lie now just buys them a reason. The only thing left to sell is distance.',
      },
      {
        speaker: 'SCARRING',
        text: 'Caught with your hand in it. You know this exact flavour of caught. Move before the shape of it finishes forming around you.',
      },
      {
        speaker: 'ENDURANCE',
        text: 'Up. Now. Push off the fire-stones and run — the passage is past the small one, and the small one is slow.',
      },
    ],
    choices: [
      {
        text: 'Kick the fire at them and bolt.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_cornered' },
      },
    ],
  },

  goblin_spotted: {
    id: 'goblin_spotted',
    narrative:
      'Your weight comes down on a shard of tin you never saw — the dead angle had a cost the map left out. The sound is small. It is enough. The pacing goblin\'s head snaps around and three pairs of eyes find you at once. The argument dies. The bright thing drops, forgotten. Somewhere a hand closes on a blade.',
    interjections: [
      {
        speaker: 'DANGER SENSE',
        text: 'I felt it go wrong half a second before it did. Too late to be useful. Forget that. Move now — decide while you\'re moving, not before. Standing still is the only wrong answer left.',
      },
      {
        speaker: 'SCARRING',
        text: 'This is the part you know. The cold drop behind the ribs. You\'ve stood exactly here before, in a worse room than this one. You walked out of that room. Remember that you walked out.',
      },
      {
        speaker: 'ENDURANCE',
        text: 'Three. You\'ve handled three. Don\'t think about three. Think about the passage behind them, and think about your legs, and nothing else.',
      },
    ],
    choices: [
      {
        text: 'Bolt for the passage and outrun them.',
        nextNodeId: 'goblin_escaped',
        check: { skillKey: 'endurance', failNodeId: 'goblin_cornered' },
      },
    ],
  },

  goblin_escaped: {
    id: 'goblin_escaped',
    narrative:
      'You break for the gap before they\'ve thought to close it. A goblin lunges and finds the place you just left; tin and bone scatter under your boots. Then you\'re in the passage and running, the firelight shrinking behind you, the shrieking thinning out as the dark drinks the sound. They don\'t follow far. Goblins never do — the tunnels past their own ground frighten them as much as they frighten anyone.',
    interjections: [
      {
        speaker: 'ENDURANCE',
        text: 'That\'s enough. Slow down before you put yourself into a wall. The lungs are allowed to hate me later.',
      },
      {
        speaker: 'DANGER SENSE',
        text: 'They\'ve stopped. Listen — no feet behind us. You\'re clear. This time, and only because they let you be.',
      },
    ],
    choices: [
      { text: 'Catch your breath, then go on.', nextNodeId: 'goblin_start' },
    ],
  },

  goblin_cornered: {
    id: 'goblin_cornered',
    narrative:
      'Your legs don\'t have it. The old knee buckles two strides in and the gap closes ahead of you. A goblin slides between you and the passage, blade held low, grinning the way small things grin when they\'ve suddenly become the larger problem. The other two fan out behind. The fire is at your back now. There is no more running to do.',
    interjections: [
      {
        speaker: 'SCARRING',
        text: 'Here it is, then. The bill for the body, come due in a goblin warren of all the stupid places.',
      },
      {
        speaker: 'ENDURANCE',
        text: 'Then we don\'t run. We plant. We set our weight and we make ourselves the most expensive thing in this room.',
      },
      {
        speaker: 'SPITE',
        text: 'You are not dying down here over a shiny scrap of tin and somebody else\'s grin. Make them regret reaching for the blade. Make it the worst decision the little one ever made.',
      },
    ],
    choices: [
      { text: 'Set your back to the fire and make them pay for it.', nextNodeId: 'goblin_start' },
    ],
  },
}
