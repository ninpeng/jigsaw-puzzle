import { forwardRef } from 'react';

import type { PuzzleSession } from '../../puzzle';
import { formatElapsedMs } from '../format';

interface PlayHudProps {
  session: PuzzleSession;
  completionRatio: number;
  elapsedMs: number;
  soundEnabled: boolean;
  toolsOpen: boolean;
  onHint: () => void;
  onGoHome: () => void;
  onToggleSound: () => void;
  onToggleTools: () => void;
  onSeparateEdges: () => void;
  onToggleReference: () => void;
}

export const PlayHud = forwardRef<HTMLElement, PlayHudProps>(function PlayHud(
  {
    session,
    completionRatio,
    elapsedMs,
    soundEnabled,
    toolsOpen,
    onHint,
    onGoHome,
    onToggleSound,
    onToggleTools,
    onSeparateEdges,
    onToggleReference
  },
  ref
) {
  return (
    <header ref={ref} className="play-hud">
      <div className="play-hud-brand">
        <span className="eyebrow">Jigsaw Bloom</span>
        <div>
          <h1>{session.definition.sourceTitle}</h1>
          <p>{session.definition.preset.label}</p>
        </div>
      </div>

      <dl className="play-hud-stats" aria-label="플레이 상태">
        <div>
          <dt>진행률</dt>
          <dd>{Math.round(completionRatio * 100)}%</dd>
        </div>
        <div>
          <dt>시간</dt>
          <dd>{formatElapsedMs(elapsedMs)}</dd>
        </div>
      </dl>

      <div className="play-hud-actions">
        <button type="button" className="accent-button" onClick={onHint}>
          힌트
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

        <div className="play-tools">
          <button
            type="button"
            className="secondary-button"
            aria-label={toolsOpen ? '도구 닫기' : '도구 열기'}
            onClick={onToggleTools}
          >
            도구
          </button>
          {toolsOpen ? (
            <div className="play-tools-menu" role="menu" aria-label="도구 메뉴">
              <button type="button" className="ghost-button" role="menuitem" onClick={onToggleReference}>
                원본 보기
              </button>
              <button
                type="button"
                className="ghost-button"
                role="menuitem"
                onClick={onSeparateEdges}
              >
                가장자리 분리
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
});
