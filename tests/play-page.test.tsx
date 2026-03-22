import { DIFFICULTY_PRESETS, type PuzzlePieceDefinition, type PuzzleSession } from '../src/puzzle';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

function makePieceDefinition(index: number): PuzzlePieceDefinition {
  return {
    id: `piece-${index}`,
    row: Math.floor(index / 4),
    col: index % 4,
    homeX: 120 + index * 10,
    homeY: 96 + index * 10,
    isEdge: true,
    connectors: { top: 0, right: 0, bottom: 0, left: 0 }
  };
}

function makeSessionPiece(index: number): PuzzleSession['pieces'][number] {
  const definition = makePieceDefinition(index);

  return {
    ...definition,
    x: 900 + index * 10,
    y: 180 + index * 12,
    fixed: false,
    zone: 'tray' as const,
    traySlotIndex: index,
    boardPosition: null
  };
}

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
    pieces: Array.from({ length: 13 }, (_unused, index) => makePieceDefinition(index))
  },
  pieces: Array.from({ length: 13 }, (_unused, index) => makeSessionPiece(index)),
  startedAt: '2026-03-13T00:00:00.000Z',
  lastUpdatedAt: '2026-03-13T00:00:00.000Z',
  elapsedMs: 0,
  completedAt: null,
  assistActions: [],
  trayCollapsed: false
};

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height
  });
}

function setPointerMode(isCoarse: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)' ? isCoarse : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

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
  PuzzleBoard: ({ currentTrayPage }: { currentTrayPage: number }) => (
    <div data-testid="mock-puzzle-board" data-tray-page={String(currentTrayPage)} />
  )
}));

import { PlayPage } from '../src/app/routes/PlayPage';

describe('PlayPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('locks the board panel height to the window viewport instead of content growth', async () => {
    setWindowSize(1280, 900);

    render(
      <MemoryRouter initialEntries={['/play/session-play-page']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('board-panel')).toHaveStyle({ height: '844px' });
  });

  it('blocks portrait mobile play and asks the user to rotate the device', async () => {
    setWindowSize(390, 844);
    setPointerMode(true);

    render(
      <MemoryRouter initialEntries={['/play/session-play-page']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('가로 모드로 돌려주세요.')).toBeInTheDocument();
    expect(screen.queryByTestId('play-viewport')).not.toBeInTheDocument();
  });

  it('allows coarse-pointer landscape play without showing the rotate guard', async () => {
    setWindowSize(844, 390);
    setPointerMode(true);

    render(
      <MemoryRouter initialEntries={['/play/session-play-page']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('play-viewport')).toBeInTheDocument();
    expect(screen.queryByText('가로 모드로 돌려주세요.')).not.toBeInTheDocument();
  });

  it('removes the rotate guard after resizing from portrait mobile to landscape', async () => {
    setWindowSize(390, 844);
    setPointerMode(true);

    render(
      <MemoryRouter initialEntries={['/play/session-play-page']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('가로 모드로 돌려주세요.')).toBeInTheDocument();

    setWindowSize(844, 390);
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(screen.getByTestId('play-viewport')).toBeInTheDocument();
    });
    expect(screen.queryByText('가로 모드로 돌려주세요.')).not.toBeInTheDocument();
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

  it('updates the tray page passed to the board when mobile paging buttons are used', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-testid') === 'play-viewport'
        ? {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 640,
            bottom: 760,
            width: 600,
            height: 760,
            toJSON() {
              return {};
            }
          }
        : {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            toJSON() {
              return {};
            }
          };
    });

    render(
      <MemoryRouter initialEntries={['/play/session-play-page']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: '다음 페이지' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-puzzle-board')).toHaveAttribute('data-tray-page', '0');

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-puzzle-board')).toHaveAttribute('data-tray-page', '1');
    });

    rectSpy.mockRestore();
  });
});
