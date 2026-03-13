import type { PuzzleSession } from '../../puzzle';
import { formatElapsedMs } from '../format';

interface PlaySidebarProps {
  session: PuzzleSession;
  completionRatio: number;
  elapsedMs: number;
  soundEnabled: boolean;
  onHint: () => void;
  onSeparateEdges: () => void;
  onGoHome: () => void;
  onToggleSound: () => void;
}

export function PlaySidebar({
  session,
  completionRatio,
  elapsedMs,
  soundEnabled,
  onHint,
  onSeparateEdges,
  onGoHome,
  onToggleSound
}: PlaySidebarProps) {
  return (
    <section className="play-sidebar">
      <div className="play-header">
        <span className="eyebrow">Now Playing</span>
        <h1>{session.definition.sourceTitle}</h1>
        <p>{session.definition.preset.label}</p>
      </div>
      <dl className="stats-grid compact">
        <div>
          <dt>진행률</dt>
          <dd>{Math.round(completionRatio * 100)}%</dd>
        </div>
        <div>
          <dt>플레이 시간</dt>
          <dd>{formatElapsedMs(elapsedMs)}</dd>
        </div>
      </dl>
      <div className="control-stack">
        <button type="button" className="accent-button" onClick={onHint}>
          힌트
        </button>
        <button type="button" className="secondary-button" onClick={onSeparateEdges}>
          가장자리 분리
        </button>
        <button
          type="button"
          className="ghost-button"
          aria-label={soundEnabled ? '사운드 켜짐' : '사운드 꺼짐'}
          onClick={onToggleSound}
        >
          {soundEnabled ? '사운드 ON' : '사운드 OFF'}
        </button>
        <button type="button" className="ghost-button" onClick={onGoHome}>
          홈으로
        </button>
      </div>
      <div className="reference-card">
        <img
          src={session.definition.thumbnailDataUrl}
          alt={`${session.definition.sourceTitle} preview`}
        />
        <p>원본 이미지를 참고하면서 조각을 맞춰 보세요.</p>
      </div>
    </section>
  );
}
