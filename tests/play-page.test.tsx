import { DIFFICULTY_PRESETS } from '../src/puzzle';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PuzzleSession } from '../src/puzzle';

const mockSession: PuzzleSession = {
  id: 'session-play-page',
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

vi.mock('../src/puzzle', async () => {
  const actual = await vi.importActual<typeof import('../src/puzzle')>('../src/puzzle');

  return {
    ...actual,
    createStorage: async () => ({
      close: vi.fn(),
      getSession: async () => mockSession,
      getSource: vi.fn(),
      listSources: vi.fn(),
      saveSource: vi.fn(),
      listSessions: vi.fn(),
      saveSession: vi.fn(),
      deleteSession: vi.fn()
    }),
    savePuzzleSession: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../src/app/audio/SoundProvider', () => ({
  useSound: () => ({
    enabled: true,
    play: vi.fn().mockResolvedValue(undefined),
    toggleEnabled: vi.fn(),
    unlock: vi.fn().mockResolvedValue(undefined)
  })
}));

vi.mock('../src/app/ui/PuzzleBoard', () => ({
  PuzzleBoard: () => <div data-testid="mock-puzzle-board" />
}));

import { PlayPage } from '../src/app/routes/PlayPage';

describe('PlayPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the play board inside a responsive full-size container', async () => {
    render(
      <MemoryRouter initialEntries={['/play/session-play-page']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('play-viewport')).toBeInTheDocument();
  });
});
