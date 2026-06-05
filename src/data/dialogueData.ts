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
export interface VoiceBeat {
  kind: 'voice'
  id?: string
  speaker: string
  text: string
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
        text: 'It\'s… it tastes off. Bole. Bole, it tastes — why\'s it taste like that. Why\'s your mouth doing that.',
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
        check: { skillKey: 'dangerSense', failNodeId: 'goblin_fight3_r2_hurt' },
      },
      {
        id: 'mushroom',
        text: 'The corpse-veil. Hurl it into their faces and see what it does.',
        nextNodeId: 'goblin_mushroom3',
        requiresUnlock: 'poison',
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
        check: { skillKey: 'dungeonLore', failNodeId: 'goblin_fight3_r3_hurt' },
      },
      {
        id: 'mushroom',
        text: 'End the question. Throw the corpse-veil.',
        nextNodeId: 'goblin_mushroom3',
        requiresUnlock: 'poison',
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
      { id: 'continue', text: 'Don\'t look back. Press on.', nextNodeId: 'goblin_start' },
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
      { id: 'continue', text: 'Coil the whip and press on.', nextNodeId: 'goblin_start' },
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
        text: 'NO — no, not that, Nim, that\'s the wrong-smell, that\'s the don\'t-go smell, why does it HAVE the—',
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
        text: 'Is it — is it food now? It can be food now, can\'t it. I\'m so hungry, Nim. I\'ve been so hungry the whole time. It doesn\'t have a name anymore. It\'s just the meat.',
      },
    ],
    choices: [
      { id: 'restart', text: '—', nextNodeId: 'goblin_start', resetsSequence: true },
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
      { id: 'fight', text: 'Then we do it the hard way.', nextNodeId: 'goblin_cornered' },
    ],
  },
}
