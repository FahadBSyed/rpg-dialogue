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
      'The passage ends at a chasm. No warning — just floor, and then not. The gap is maybe eight feet across. Maybe ten. The torch doesn\'t reach the bottom. Something moves in the air coming up from it, a cold that isn\'t quite wind.',
    interjections: [
      {
        speaker: 'DANGER SENSE',
        text: 'Don\'t look down. You already know you shouldn\'t look down. That\'s not helpful. What\'s helpful: the ledge on the other side is solid. It\'s the same height. You have enough room to land.',
      },
      {
        speaker: 'WAYFINDING',
        text: 'Eight feet. Ten at most. The angle is level — no uphill component to the jump. The far ledge is maybe two feet deep before it hits the wall. You will need to stick it.',
      },
      {
        speaker: 'SCARRING',
        text: 'You have fallen before. Not into a chasm. Into a pit, in the Ashrun tunnels, when you were younger and less careful. You remember the specific quality of that silence on the way down. You don\'t want to find out if this sounds the same.',
      },
    ],
    choices: [
      {
        text: 'Take a breath. Then jump.',
        nextNodeId: 'landed',
        check: { skillKey: 'endurance', failNodeId: 'fell' },
      },
      {
        text: 'There has to be another way. Look around.',
        nextNodeId: 'look_around',
      },
    ],
  },

  look_around: {
    id: 'look_around',
    narrative:
      'There is no other way. There is the passage you came from, and the chasm, and the other side. The dungeon is not offering alternatives. It rarely does.',
    interjections: [
      {
        speaker: 'WAYFINDING',
        text: 'You mapped what\'s behind you. There are no branches you missed. This is the only forward.',
      },
      {
        speaker: 'HUNGER',
        text: 'You have been down here long enough that turning back is its own kind of cost. Just noting that.',
      },
    ],
    choices: [
      {
        text: 'Jump.',
        nextNodeId: 'landed',
        check: { skillKey: 'endurance', failNodeId: 'fell' },
      },
      {
        text: 'Turn back.',
        nextNodeId: 'turn_back',
      },
    ],
  },

  landed: {
    id: 'landed',
    narrative:
      'You land hard. Both feet, then one knee on the stone. The far ledge holds. You stay still for a moment — crouched, breathing, listening to the chasm settle behind you. Then you stand. The passage continues.',
    interjections: [
      {
        speaker: 'ENDURANCE',
        text: 'That\'s done. The knee will complain later. It can wait.',
      },
      {
        speaker: 'DANGER SENSE',
        text: 'Good. Now move. Don\'t give the dungeon time to think of something else.',
      },
    ],
    choices: [
      { text: 'Press on.', nextNodeId: 'start' },
    ],
  },

  fell: {
    id: 'fell',
    narrative:
      'The jump is wrong from the start — your back foot slips on loose grit at the edge. You don\'t clear the gap. Your hands catch the far ledge. The torch falls. For a moment there is just your grip and the sound of the torch hitting something far below, and then silence.',
    interjections: [
      {
        speaker: 'ENDURANCE',
        text: 'Hold on. Don\'t think about the drop. Don\'t think about anything. Just hold on and pull.',
      },
      {
        speaker: 'SCARRING',
        text: 'There it is. That silence. You knew what it sounded like after all.',
      },
      {
        speaker: 'SPITE',
        text: 'You are not dying in a ditch eight feet wide. Get up.',
      },
    ],
    choices: [
      { text: 'Haul yourself up. Slowly.', nextNodeId: 'landed' },
    ],
  },

  turn_back: {
    id: 'turn_back',
    narrative:
      'You walk back the way you came. The chasm is still there behind you. It will still be there if you return. The dungeon is patient about these things.',
    interjections: [
      {
        speaker: 'WAYFINDING',
        text: 'Noted. The chasm is at this depth, this bearing. You know where it is now. That\'s something.',
      },
    ],
    choices: [
      { text: 'Go back to the chasm.', nextNodeId: 'start' },
    ],
  },
}
