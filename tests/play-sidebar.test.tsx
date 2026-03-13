import { fireEvent, render, screen } from '@testing-library/react';

import { DIFFICULTY_PRESETS, type PuzzleSession } from '../src/puzzle';
import { PlaySidebar } from '../src/app/routes/PlaySidebar';

const session: PuzzleSession = {
  id: 'session-1',
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
  elapsedMs: 18000,
  completedAt: null,
  assistActions: []
};

describe('PlaySidebar', () => {
  it('delegates hint, edge separation, home navigation, and sound toggle', () => {
    const onHint = vi.fn();
    const onSeparateEdges = vi.fn();
    const onGoHome = vi.fn();
    const onToggleSound = vi.fn();

    render(
      <PlaySidebar
        session={session}
        completionRatio={0.35}
        elapsedMs={18000}
        soundEnabled
        onHint={onHint}
        onSeparateEdges={onSeparateEdges}
        onGoHome={onGoHome}
        onToggleSound={onToggleSound}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '힌트' }));
    fireEvent.click(screen.getByRole('button', { name: '가장자리 분리' }));
    fireEvent.click(screen.getByRole('button', { name: '홈으로' }));
    fireEvent.click(screen.getByRole('button', { name: '사운드 켜짐' }));

    expect(onHint).toHaveBeenCalled();
    expect(onSeparateEdges).toHaveBeenCalled();
    expect(onGoHome).toHaveBeenCalled();
    expect(onToggleSound).toHaveBeenCalled();
  });
});
