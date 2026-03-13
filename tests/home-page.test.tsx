import { fireEvent, render, screen } from '@testing-library/react';

import { DIFFICULTY_PRESETS } from '../src/puzzle';
import type { PuzzleSessionSummary, PuzzleSource } from '../src/puzzle';
import { HomePage } from '../src/app/routes/HomePage';

const sources: PuzzleSource[] = [
  {
    id: 'built-in-aurora',
    type: 'built_in',
    title: 'Aurora Lake',
    imageDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    thumbnailDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    imageWidth: 1600,
    imageHeight: 900
  }
];

const sessions: PuzzleSessionSummary[] = [
  {
    id: 'session-built-in-aurora-easy',
    sourceTitle: 'Aurora Lake',
    presetLabel: '쉬움',
    completionRatio: 0.42,
    lastUpdatedAt: '2026-03-13T10:00:00.000Z',
    completedAt: null
  }
];

describe('HomePage', () => {
  it('renders puzzle sources and starts a new game with the selected difficulty', () => {
    const onDifficultyChange = vi.fn();
    const onStartPuzzle = vi.fn();
    const onUiClick = vi.fn();

    render(
      <HomePage
        sources={sources}
        sessions={[]}
        selectedDifficulty={DIFFICULTY_PRESETS.easy}
        soundEnabled
        uploadError={null}
        onDifficultyChange={onDifficultyChange}
        onToggleSound={vi.fn()}
        onUiClick={onUiClick}
        onStartPuzzle={onStartPuzzle}
        onResumeSession={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );

    expect(screen.getByText('Aurora Lake')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('난이도'), {
      target: { value: DIFFICULTY_PRESETS.medium.id }
    });
    expect(onDifficultyChange).toHaveBeenCalledWith('medium');

    fireEvent.click(screen.getByRole('button', { name: 'Aurora Lake 시작하기' }));
    expect(onUiClick).toHaveBeenCalled();
    expect(onStartPuzzle).toHaveBeenCalledWith('built-in-aurora', 'easy');
  });

  it('shows resumable sessions and delegates resume actions', () => {
    const onResumeSession = vi.fn();

    render(
      <HomePage
        sources={sources}
        sessions={sessions}
        selectedDifficulty={DIFFICULTY_PRESETS.easy}
        soundEnabled
        uploadError={null}
        onDifficultyChange={vi.fn()}
        onToggleSound={vi.fn()}
        onUiClick={vi.fn()}
        onStartPuzzle={vi.fn()}
        onResumeSession={onResumeSession}
        onUploadFile={vi.fn()}
      />
    );

    expect(screen.getByText('이어하기')).toBeInTheDocument();
    expect(screen.getByText(/42% 완료/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aurora Lake 이어하기' }));
    expect(onResumeSession).toHaveBeenCalledWith('session-built-in-aurora-easy');
  });

  it('shows the sound toggle and delegates state changes', () => {
    const onToggleSound = vi.fn();

    render(
      <HomePage
        sources={sources}
        sessions={[]}
        selectedDifficulty={DIFFICULTY_PRESETS.easy}
        soundEnabled
        uploadError={null}
        onDifficultyChange={vi.fn()}
        onToggleSound={onToggleSound}
        onUiClick={vi.fn()}
        onStartPuzzle={vi.fn()}
        onResumeSession={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '사운드 켜짐' }));
    expect(onToggleSound).toHaveBeenCalled();
  });
});
