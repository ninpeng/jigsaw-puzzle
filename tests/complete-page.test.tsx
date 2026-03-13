import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DIFFICULTY_PRESETS, type PuzzleSession } from '../src/puzzle';
import { CompletePage } from '../src/app/routes/CompletePage';

const session: PuzzleSession = {
  id: 'session-complete',
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
  elapsedMs: 42000,
  completedAt: '2026-03-13T00:01:00.000Z',
  assistActions: [{ type: 'hint', timestamp: '2026-03-13T00:00:10.000Z' }]
};

describe('CompletePage', () => {
  it('delegates restart and link click interactions', () => {
    const onRestart = vi.fn();
    const onUiClick = vi.fn();

    render(
      <MemoryRouter>
        <CompletePage session={session} onRestart={onRestart} onUiClick={onUiClick} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '다시 시작하기' }));
    fireEvent.click(screen.getByRole('link', { name: '홈으로 돌아가기' }));

    expect(onRestart).toHaveBeenCalled();
    expect(onUiClick).toHaveBeenCalledTimes(2);
  });
});
