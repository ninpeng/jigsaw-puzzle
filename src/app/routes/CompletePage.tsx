import { Link } from 'react-router-dom';

import type { PuzzleSession } from '../../puzzle';
import { formatElapsedMs } from '../format';

interface CompletePageProps {
  session: PuzzleSession;
  onRestart: () => void;
  onUiClick: () => void;
}

export function CompletePage({ session, onRestart, onUiClick }: CompletePageProps) {
  const hintCount = session.assistActions.filter((action) => action.type === 'hint').length;
  const edgeAssistCount = session.assistActions.filter(
    (action) => action.type === 'separate_edges'
  ).length;

  return (
    <main className="complete-shell">
      <section className="complete-panel">
        <span className="eyebrow">Completed</span>
        <h1>{session.definition.sourceTitle} 완성</h1>
        <p>조각이 모두 제자리에 놓였습니다. 같은 이미지로 다시 도전하거나 새 퍼즐을 골라 보세요.</p>
        <dl className="stats-grid">
          <div>
            <dt>완성 시간</dt>
            <dd>{formatElapsedMs(session.elapsedMs)}</dd>
          </div>
          <div>
            <dt>힌트 사용</dt>
            <dd>{hintCount}회</dd>
          </div>
          <div>
            <dt>가장자리 분리</dt>
            <dd>{edgeAssistCount}회</dd>
          </div>
          <div>
            <dt>난이도</dt>
            <dd>{session.definition.preset.label}</dd>
          </div>
        </dl>
        <div className="complete-actions">
          <button
            type="button"
            className="accent-button"
            onClick={() => {
              onUiClick();
              onRestart();
            }}
          >
            다시 시작하기
          </button>
          <Link
            className="secondary-link"
            to="/"
            onClick={() => {
              onUiClick();
            }}
          >
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
