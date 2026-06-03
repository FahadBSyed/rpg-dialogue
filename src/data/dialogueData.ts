export interface DialogueChoice {
  text: string
  nextNodeId: string
}

export interface DialogueNode {
  id: string
  narrative: string
  choices: DialogueChoice[]
}

export const dialogueNodes: Record<string, DialogueNode> = {
  start: {
    id: 'start',
    narrative:
      'The dungeon swallows sound. Somewhere below, water moves through limestone in the dark. You have been here before — or somewhere enough like here that the difference stopped mattering. Your torch is low. Two tunnels branch ahead.',
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
    choices: [
      { text: 'Press forward into the dark.', nextNodeId: 'press_forward' },
      { text: 'Go back to the fork.', nextNodeId: 'start' },
    ],
  },

  turn_back: {
    id: 'turn_back',
    narrative:
      'You turn. The passage behind you looks different than it did — narrower, or perhaps just less certain. The dungeon has a way of rearranging itself around hesitation. You are back at the fork.',
    choices: [
      { text: 'Take the left tunnel after all.', nextNodeId: 'left_tunnel' },
      {
        text: 'Stand here a moment longer.',
        nextNodeId: 'stand_still',
      },
    ],
  },

  press_forward: {
    id: 'press_forward',
    narrative:
      'The chamber is vast. Your torch reaches maybe six feet in any direction. The floor is dry here — unusual this deep. In the center of what you can see, something has been arranged deliberately. Stones in a pattern. Old work.',
    choices: [
      { text: 'Examine the stone arrangement.', nextNodeId: 'examine_stones' },
      { text: 'Circle the room along the wall.', nextNodeId: 'circle_room' },
      { text: 'Go back the way you came.', nextNodeId: 'left_tunnel' },
    ],
  },

  stand_still: {
    id: 'stand_still',
    narrative:
      'You stand at the fork and listen. The dungeon makes sounds if you wait long enough — settling stone, water finding new paths, things that are not quite sounds at all. After a while it becomes difficult to tell what you are hearing and what you are remembering.',
    choices: [
      { text: 'Take the left tunnel.', nextNodeId: 'left_tunnel' },
      {
        text: 'You have been standing here long enough.',
        nextNodeId: 'start',
      },
    ],
  },

  examine_stones: {
    id: 'examine_stones',
    narrative:
      'Someone placed these with care. The arrangement is deliberate — not a marker or a warning but something closer to a record. The stones are of different types, sourced from different depths. Whoever did this knew the dungeon well enough to know what each one meant.',
    choices: [
      { text: 'Take one of the stones.', nextNodeId: 'take_stone' },
      { text: 'Leave it as you found it.', nextNodeId: 'circle_room' },
    ],
  },

  circle_room: {
    id: 'circle_room',
    narrative:
      'The wall is rough under your hand. You find two exits — one you came from, and one that descends. The descent is steep and the air coming up from it is cold in a way that has nothing to do with temperature.',
    choices: [
      { text: 'Descend.', nextNodeId: 'press_forward' },
      { text: 'Go back to the stone arrangement.', nextNodeId: 'examine_stones' },
      { text: 'Return the way you came.', nextNodeId: 'left_tunnel' },
    ],
  },

  take_stone: {
    id: 'take_stone',
    narrative:
      'The stone is heavier than it looks. Warm, which makes no sense. You put it in your pack and the arrangement is incomplete now — a gap where something was. The room feels different. Not hostile. Attentive.',
    choices: [
      { text: 'Continue exploring the chamber.', nextNodeId: 'circle_room' },
      { text: 'Leave immediately.', nextNodeId: 'left_tunnel' },
    ],
  },
}
