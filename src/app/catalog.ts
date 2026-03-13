import type { PuzzleSource } from '../puzzle';

export const BUILT_IN_SOURCES: PuzzleSource[] = [
  {
    id: 'built-in-aurora',
    type: 'built_in',
    title: 'Aurora Lake',
    imageDataUrl: '/assets/puzzles/aurora-lake.svg',
    thumbnailDataUrl: '/assets/puzzles/aurora-lake.svg',
    imageWidth: 1600,
    imageHeight: 900
  },
  {
    id: 'built-in-market',
    type: 'built_in',
    title: 'Sunlit Market',
    imageDataUrl: '/assets/puzzles/sunlit-market.svg',
    thumbnailDataUrl: '/assets/puzzles/sunlit-market.svg',
    imageWidth: 1600,
    imageHeight: 900
  },
  {
    id: 'built-in-garden',
    type: 'built_in',
    title: 'Citrus Garden',
    imageDataUrl: '/assets/puzzles/citrus-garden.svg',
    thumbnailDataUrl: '/assets/puzzles/citrus-garden.svg',
    imageWidth: 1600,
    imageHeight: 900
  }
];
