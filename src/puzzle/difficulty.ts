import type { DifficultyPreset } from './types';

export const DIFFICULTY_PRESETS: Record<DifficultyPreset['id'], DifficultyPreset> = {
  easy: {
    id: 'easy',
    label: '쉬움',
    rows: 4,
    cols: 6,
    snapDistance: 18
  },
  medium: {
    id: 'medium',
    label: '보통',
    rows: 6,
    cols: 8,
    snapDistance: 16
  },
  hard: {
    id: 'hard',
    label: '어려움',
    rows: 8,
    cols: 10,
    snapDistance: 14
  }
};
