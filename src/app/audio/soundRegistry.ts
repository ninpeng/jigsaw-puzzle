export const SOUND_IDS = [
  'ui_click',
  'puzzle_start',
  'piece_pickup',
  'piece_drop',
  'piece_snap',
  'hint',
  'separate_edges',
  'puzzle_complete'
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export interface SoundDefinition {
  src: string;
  volume: number;
}

export const SOUND_REGISTRY: Record<SoundId, SoundDefinition> = {
  ui_click: {
    src: '/assets/audio/ui-click.wav',
    volume: 0.56
  },
  puzzle_start: {
    src: '/assets/audio/puzzle-start.wav',
    volume: 0.62
  },
  piece_pickup: {
    src: '/assets/audio/piece-pickup.wav',
    volume: 0.48
  },
  piece_drop: {
    src: '/assets/audio/piece-drop.wav',
    volume: 0.52
  },
  piece_snap: {
    src: '/assets/audio/piece-snap.wav',
    volume: 0.7
  },
  hint: {
    src: '/assets/audio/hint.wav',
    volume: 0.6
  },
  separate_edges: {
    src: '/assets/audio/separate-edges.wav',
    volume: 0.58
  },
  puzzle_complete: {
    src: '/assets/audio/puzzle-complete.wav',
    volume: 0.76
  }
};
