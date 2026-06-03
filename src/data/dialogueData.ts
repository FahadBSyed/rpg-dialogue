import type { SkillKey } from '../store/gameStore'

export interface DialogueChoice {
  text: string
  nextNodeId: string
  check?: { skillKey: SkillKey; failNodeId?: string }
}

export interface Interjection {
  speaker: string
  text: string
}

export interface DialogueNode {
  id: string
  narrative: string
  interjections: Interjection[]
  choices: DialogueChoice[]
}

export const dialogueNodes: Record<string, DialogueNode> = {
  start: {
    id: 'start',
    narrative:
      'The dungeon swallows sound. Somewhere below, water moves through limestone in the dark. You have been here before — or somewhere enough like here that the difference stopped mattering. Your torch is low. Two tunnels branch ahead.',
    interjections: [
      {
        speaker: 'DANGER SENSE',
        text: 'The left tunnel. Something is wrong with the left tunnel. You don\'t know what yet. You just know.',
      },
      {
        speaker: 'WAYFINDING',
        text: 'The fork angles at roughly forty degrees. The left passage descends. The right holds level or rises slightly — difficult to tell in this light. Descending passages collect water. Rising ones collect other things.',
      },
      {
        speaker: 'HUNGER',
        text: 'Your last meal was. When was your last meal. The torch being low is a secondary concern. Your blood sugar is a primary concern. These two facts are related.',
      },
      {
        speaker: 'THE DEEP',
        text: 'The water below has been moving for longer than anyone has been counting.',
      },
    ],
    choices: [
      { text: 'Take the left tunnel.', nextNodeId: 'left_tunnel' },
      {
        text: 'Turn back. There is nothing down here worth dying for.',
        nextNodeId: 'turn_back',
      },
    ],
  },

  left_tunnel: {
    id: 'left_tunnel',
    narrative:
      'The left tunnel narrows almost immediately. The walls are slick with moisture and something older than moisture — a residue that smells of iron and time. The torch gutters. Ahead, the passage opens into darkness too large to be a corridor.',
    interjections: [
      {
        speaker: 'DUNGEON LORE',
        text: 'Limestone this wet means an active water table nearby. The iron smell is oxidized mineral deposits or old blood. Statistically, mineral deposits.',
      },
      {
        speaker: 'SCARRING',
        text: 'You know that smell. You have a scar from the last time you knew that smell and didn\'t listen.',
      },
      {
        speaker: 'SUPERSTITION',
        text: 'A passage that narrows is a passage that wants you to turn back. The dungeon narrows its corridors the way a throat narrows before bad news.',
      },
      {
        speaker: 'ENDURANCE',
        text: 'You are cold. You have been cold before. Cold is survivable. Keep moving.',
      },
    ],
    choices: [
      { text: 'Press forward into the dark.', nextNodeId: 'press_forward' },
      { text: 'Go back to the fork.', nextNodeId: 'start' },
    ],
  },

  turn_back: {
    id: 'turn_back',
    narrative:
      'You turn. The passage behind you looks different than it did — narrower, or perhaps just less certain. The dungeon has a way of rearranging itself around hesitation. You are back at the fork.',
    interjections: [
      {
        speaker: 'SPITE',
        text: 'Of course it looks different. Of course. The dungeon saw you hesitate and it filed that away.',
      },
      {
        speaker: 'WAYFINDING',
        text: 'The geometry hasn\'t changed. The passage is the same width it was. Your perception of it has changed. Note the difference.',
      },
      {
        speaker: 'DECEPTION',
        text: 'You told yourself you were turning back for a good reason. Were you.',
      },
      {
        speaker: 'REPUTATION',
        text: 'No one saw this. That\'s something.',
      },
    ],
    choices: [
      { text: 'Take the left tunnel after all.', nextNodeId: 'left_tunnel' },
      { text: 'Stand here a moment longer.', nextNodeId: 'stand_still' },
    ],
  },

  press_forward: {
    id: 'press_forward',
    narrative:
      'The chamber is vast. Your torch reaches maybe six feet in any direction. The floor is dry here — unusual this deep. In the center of what you can see, something has been arranged deliberately. Stones in a pattern. Old work.',
    interjections: [
      {
        speaker: 'THE DEEP',
        text: 'Dry floor this deep means the water changed course. Something redirected it. Something large, or something deliberate.',
      },
      {
        speaker: 'DANGER SENSE',
        text: 'Don\'t stand in the center of the room.',
      },
      {
        speaker: 'APPRAISAL',
        text: 'Stones arranged deliberately in an abandoned chamber. Value: unknown. Risk: moderate. The cost of examining is the time spent examining.',
      },
      {
        speaker: 'DUNGEON LORE',
        text: 'Purpose-built dryness in a wet limestone system. Someone constructed drainage or the water table shifted. Both possibilities have implications you should think through before moving.',
      },
    ],
    choices: [
      {
        text: 'Study the arrangement. You have seen something like this before.',
        nextNodeId: 'examine_stones',
        check: { skillKey: 'dungeonLore', failNodeId: 'examine_stones_fail' },
      },
      { text: 'Examine the stone arrangement.', nextNodeId: 'examine_stones' },
      { text: 'Circle the room along the wall.', nextNodeId: 'circle_room' },
      { text: 'Go back the way you came.', nextNodeId: 'left_tunnel' },
    ],
  },

  stand_still: {
    id: 'stand_still',
    narrative:
      'You stand at the fork and listen. The dungeon makes sounds if you wait long enough — settling stone, water finding new paths, things that are not quite sounds at all. After a while it becomes difficult to tell what you are hearing and what you are remembering.',
    interjections: [
      {
        speaker: 'HUNGER',
        text: 'You are burning calories standing here. This is a fact.',
      },
      {
        speaker: 'SUPERSTITION',
        text: 'Three sounds you couldn\'t identify. In delver counting, three unidentified sounds at a junction means the junction is watching you back.',
      },
      {
        speaker: 'THE DEEP',
        text: 'Something down here has been listening for longer than you have been alive.',
      },
      {
        speaker: 'SCARRING',
        text: 'You stood at a fork like this once before. You took the wrong one. You have the proof of it on your left forearm.',
      },
    ],
    choices: [
      { text: 'Take the left tunnel.', nextNodeId: 'left_tunnel' },
      { text: 'You have been standing here long enough.', nextNodeId: 'start' },
    ],
  },

  examine_stones: {
    id: 'examine_stones',
    narrative:
      'Someone placed these with care. The arrangement is deliberate — not a marker or a warning but something closer to a record. The stones are of different types, sourced from different depths. Whoever did this knew the dungeon well enough to know what each one meant.',
    interjections: [
      {
        speaker: 'DUNGEON LORE',
        text: 'Surface limestone, deep granite, something metamorphic that shouldn\'t be at this elevation, and one you don\'t recognize. The unrecognized one is the important one.',
      },
      {
        speaker: 'APPRAISAL',
        text: 'Someone spent significant time on this. Time is the most expensive resource underground. Whatever this records, the maker believed it was worth days.',
      },
      {
        speaker: 'SUPERSTITION',
        text: 'Don\'t disturb the arrangement. Whatever it\'s keeping in place has been in place for a long time. Things kept in place for a long time are in place for reasons.',
      },
      {
        speaker: 'THE DEEP',
        text: 'The stone you don\'t recognize came from very far down. You can feel it from here. It doesn\'t belong at this depth. Neither do you.',
      },
    ],
    choices: [
      {
        text: 'Take the unrecognized stone. Your instincts say it matters.',
        nextNodeId: 'take_stone',
        check: { skillKey: 'superstition', failNodeId: 'take_stone_fail' },
      },
      { text: 'Take one of the stones.', nextNodeId: 'take_stone' },
      { text: 'Leave it as you found it.', nextNodeId: 'circle_room' },
    ],
  },

  circle_room: {
    id: 'circle_room',
    narrative:
      'The wall is rough under your hand. You find two exits — one you came from, and one that descends. The descent is steep and the air coming up from it is cold in a way that has nothing to do with temperature.',
    interjections: [
      {
        speaker: 'WAYFINDING',
        text: 'The descent angles northeast if your bearings are correct, which they might not be. Magnetic interference is common this deep. Trust the slope more than the direction.',
      },
      {
        speaker: 'DANGER SENSE',
        text: 'Cold that rises means something warm below. Something is generating heat down there. You should think carefully about what generates heat in the dark.',
      },
      {
        speaker: 'SCAVENGING',
        text: 'Tool marks on the wall. Old ones. Someone worked this passage. Where there were workers there were camps. Where there were camps there were things left behind.',
      },
    ],
    choices: [
      { text: 'Descend.', nextNodeId: 'press_forward' },
      { text: 'Go back to the stone arrangement.', nextNodeId: 'examine_stones' },
      { text: 'Return the way you came.', nextNodeId: 'left_tunnel' },
    ],
  },

  examine_stones_fail: {
    id: 'examine_stones_fail',
    narrative:
      'You crouch over the arrangement for a long time. The stones resist meaning. You know they are significant — the care taken is obvious — but whatever system they encode is beyond you. You are looking at a language you do not speak.',
    interjections: [
      {
        speaker: 'DUNGEON LORE',
        text: 'You catalogued the stone types. You noted the deliberate placement. The gap between observation and understanding has never felt wider.',
      },
      {
        speaker: 'SPITE',
        text: 'Someone knew something you don\'t. That is an unpleasant sentence to sit with.',
      },
    ],
    choices: [
      { text: 'Continue studying — perhaps something will become clear.', nextNodeId: 'examine_stones' },
      { text: 'Leave it. Move on.', nextNodeId: 'circle_room' },
    ],
  },

  take_stone_fail: {
    id: 'take_stone_fail',
    narrative:
      'Your hand closes around the unrecognized stone. Something resists — not physically, but in a way that is harder to describe. You release it. The room feels the same as it did before you reached. That is somehow worse.',
    interjections: [
      {
        speaker: 'SUPERSTITION',
        text: 'You felt it. Whatever gave you the instinct to take it also told you, in the same moment, that you were wrong. Those two things should not both be true.',
      },
      {
        speaker: 'THE DEEP',
        text: 'The stone is still there. It is not finished with you.',
      },
    ],
    choices: [
      { text: 'Try again. Take it anyway.', nextNodeId: 'take_stone' },
      { text: 'Step back. Leave it alone.', nextNodeId: 'circle_room' },
    ],
  },

  take_stone: {
    id: 'take_stone',
    narrative:
      'The stone is heavier than it looks. Warm, which makes no sense. You put it in your pack and the arrangement is incomplete now — a gap where something was. The room feels different. Not hostile. Attentive.',
    interjections: [
      {
        speaker: 'SUPERSTITION',
        text: 'It\'s warm because it remembers warmth. Stones at this depth are never warm on their own. Something was done to this stone. You have taken a thing that had something done to it.',
      },
      {
        speaker: 'THE DEEP',
        text: 'The arrangement was a record. You have removed a word from it. The sentence now means something different. You don\'t know what it used to say.',
      },
      {
        speaker: 'APPRAISAL',
        text: 'Warm stone, unusual composition, deliberately placed in a ritual context. Potentially significant value. To the right buyer. The hard part is finding the right buyer.',
      },
      {
        speaker: 'SCARRING',
        text: 'You know the weight of things that cost you later. Heavy and warm. Add it to the inventory.',
      },
    ],
    choices: [
      { text: 'Continue exploring the chamber.', nextNodeId: 'circle_room' },
      { text: 'Leave immediately.', nextNodeId: 'left_tunnel' },
    ],
  },
}
