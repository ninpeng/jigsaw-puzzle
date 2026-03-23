import { useRef } from 'react';

import type { DifficultyPreset, PuzzleSessionSummary, PuzzleSource } from '../../puzzle';
import { formatPercent } from '../format';
import type { PendingUploadImage } from '../upload';
import { UploadReviewDialog } from './UploadReviewDialog';

interface HomePageProps {
  sources: PuzzleSource[];
  sessions: PuzzleSessionSummary[];
  selectedDifficulty: DifficultyPreset;
  soundEnabled: boolean;
  uploadError: string | null;
  pendingUpload: PendingUploadImage | null;
  onDifficultyChange: (difficultyId: DifficultyPreset['id']) => void;
  onToggleSound: () => void;
  onUiClick: () => void;
  onStartPuzzle: (sourceId: string, difficultyId: DifficultyPreset['id']) => void;
  onResumeSession: (sessionId: string) => void;
  onUploadFile: (file: File) => void;
  onRotatePendingUploadLeft: () => void;
  onRotatePendingUploadRight: () => void;
  onConfirmPendingUpload: () => void;
  onCancelPendingUpload: () => void;
}

export function HomePage({
  sources,
  sessions,
  selectedDifficulty,
  soundEnabled,
  uploadError,
  pendingUpload,
  onDifficultyChange,
  onToggleSound,
  onUiClick,
  onStartPuzzle,
  onResumeSession,
  onUploadFile,
  onRotatePendingUploadLeft,
  onRotatePendingUploadRight,
  onConfirmPendingUpload,
  onCancelPendingUpload
}: HomePageProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <main className="app-shell">
        <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Jigsaw Bloom</span>
          <h1>편안하게 몰입하는 브라우저 직소퍼즐</h1>
          <p>
            기본 제공 이미지로 바로 시작하거나, 원하는 사진을 올려 나만의 퍼즐을 만들 수
            있습니다. 모든 진행 상황은 이 브라우저 안에 저장됩니다.
          </p>
        </div>
        <div className="hero-controls">
          <label className="field">
            <span>난이도</span>
            <select
              aria-label="난이도"
              value={selectedDifficulty.id}
              onChange={(event) =>
                onDifficultyChange(event.currentTarget.value as DifficultyPreset['id'])
              }
            >
              <option value="easy">쉬움</option>
              <option value="medium">보통</option>
              <option value="hard">어려움</option>
            </select>
          </label>
          <button
            className="ghost-button"
            type="button"
            aria-label={soundEnabled ? '사운드 켜짐' : '사운드 꺼짐'}
            onClick={() => {
              onUiClick();
              onToggleSound();
            }}
          >
            {soundEnabled ? '사운드 ON' : '사운드 OFF'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              onUiClick();
              inputRef.current?.click();
            }}
          >
            이미지 업로드
          </button>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              if (file) {
                onUploadFile(file);
              }

              event.currentTarget.value = '';
            }}
          />
          {uploadError ? <p className="error-text">{uploadError}</p> : null}
        </div>
        </section>

        {sessions.length > 0 ? (
          <section className="resume-panel">
            <div className="section-heading">
              <h2>이어하기</h2>
              <p>마지막으로 플레이한 퍼즐을 바로 이어서 완성해 보세요.</p>
            </div>
            <div className="resume-grid">
              {sessions.map((session) => (
                <article key={session.id} className="resume-card">
                  <div>
                    <h3>{session.sourceTitle}</h3>
                    <p>{session.presetLabel}</p>
                  </div>
                  <p>{formatPercent(session.completionRatio)} 완료</p>
                  <button
                    type="button"
                    className="accent-button"
                    aria-label={`${session.sourceTitle} 이어하기`}
                    onClick={() => {
                      onUiClick();
                      onResumeSession(session.id);
                    }}
                  >
                    계속하기
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="catalog-panel">
          <div className="section-heading">
            <h2>퍼즐 컬렉션</h2>
            <p>기본 퍼즐과 업로드한 이미지를 같은 엔진으로 플레이합니다.</p>
          </div>
          <div className="catalog-grid">
            {sources.map((source) => (
              <article key={source.id} className="puzzle-card">
                <img src={source.thumbnailDataUrl} alt="" />
                <div className="puzzle-card-body">
                  <div>
                    <span className="source-chip">
                      {source.type === 'built_in' ? 'Curated' : 'Uploaded'}
                    </span>
                    <h3>{source.title}</h3>
                  </div>
                  <button
                    type="button"
                    className="accent-button"
                    aria-label={`${source.title} 시작하기`}
                    onClick={() => {
                      onUiClick();
                      onStartPuzzle(source.id, selectedDifficulty.id);
                    }}
                  >
                    시작하기
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {pendingUpload ? (
        <UploadReviewDialog
          pendingUpload={pendingUpload}
          onRotateLeft={onRotatePendingUploadLeft}
          onRotateRight={onRotatePendingUploadRight}
          onCancel={onCancelPendingUpload}
          onConfirm={onConfirmPendingUpload}
        />
      ) : null}
    </>
  );
}
