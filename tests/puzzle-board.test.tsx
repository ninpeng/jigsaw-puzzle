import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DIFFICULTY_PRESETS, type PuzzleSession } from '../src/puzzle';

const phaserMocks = vi.hoisted(() => {
  const setZoom = vi.fn();
  const destroy = vi.fn();
  class Game {
    scale = { setZoom };
    destroy = destroy;
  }

  return {
    setZoom,
    destroy,
    Game
  };
});

vi.mock('phaser', () => {
  class Scene {
    constructor(_key?: string) {}
  }

  return {
    default: {
      Game: phaserMocks.Game,
      Scene,
      CANVAS: 'CANVAS'
    },
    Game: phaserMocks.Game,
    Scene,
    CANVAS: 'CANVAS'
  };
});

import { PuzzleBoard } from '../src/app/ui/PuzzleBoard';

const session: PuzzleSession = {
  id: 'session-board',
  definition: {
    id: 'built-in-aurora:easy',
    sourceId: 'built-in-aurora',
    sourceType: 'built_in',
    sourceTitle: 'Aurora Lake',
    imageDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    thumbnailDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    imageWidth: 1600,
    imageHeight: 900,
    preset: DIFFICULTY_PRESETS.easy,
    board: { x: 120, y: 96, width: 720, height: 480 },
    pieceWidth: 120,
    pieceHeight: 120,
    pieces: []
  },
  pieces: [],
  startedAt: '2026-03-13T00:00:00.000Z',
  lastUpdatedAt: '2026-03-13T00:00:00.000Z',
  elapsedMs: 0,
  completedAt: null,
  assistActions: [],
  trayCollapsed: false
};

describe('PuzzleBoard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies viewport-based zoom to the Phaser game', async () => {
    const { rerender } = render(
      <PuzzleBoard
        session={session}
        highlightedPieceId={null}
        viewportSize={{ width: 590, height: 380 }}
        onPlaySound={vi.fn()}
        onSessionChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(phaserMocks.setZoom).toHaveBeenLastCalledWith(0.5);
    });

    rerender(
      <PuzzleBoard
        session={session}
        highlightedPieceId={null}
        viewportSize={{ width: 1180, height: 760 }}
        onPlaySound={vi.fn()}
        onSessionChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(phaserMocks.setZoom).toHaveBeenLastCalledWith(1);
    });
  });
});
