import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  createHint,
  createPuzzleDefinition,
  createPuzzleSession,
  createStorage,
  savePuzzleSession,
  separateEdgePieces,
  type PuzzleSession,
  type PuzzleSource
} from '../../puzzle';
import { useSound } from '../audio/SoundProvider';
import { CompletePage } from './CompletePage';
import { PlaySidebar } from './PlaySidebar';

const PuzzleBoard = lazy(async () => {
  const module = await import('../ui/PuzzleBoard');
  return { default: module.PuzzleBoard };
});

function makeSourceFromSession(session: PuzzleSession): PuzzleSource {
  return {
    id: session.definition.sourceId,
    type: session.definition.sourceType,
    title: session.definition.sourceTitle,
    imageDataUrl: session.definition.imageDataUrl,
    thumbnailDataUrl: session.definition.thumbnailDataUrl,
    imageWidth: session.definition.imageWidth,
    imageHeight: session.definition.imageHeight
  };
}

export function PlayPage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const { enabled, play, toggleEnabled } = useSound();
  const [session, setSession] = useState<PuzzleSession | null>(null);
  const [playViewportSize, setPlayViewportSize] = useState({ width: 0, height: 0 });
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const lastTickRef = useRef<number | null>(null);
  const playViewportRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const completionHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    createStorage()
      .then((storage) => storage.getSession(sessionId))
      .then((storedSession) => {
        if (cancelled) {
          return;
        }

        if (!storedSession) {
          setError('저장된 퍼즐을 찾을 수 없습니다.');
          setLoaded(true);
          return;
        }

        setSession(storedSession);
        setElapsedMs(storedSession.elapsedMs);
        lastTickRef.current = storedSession.completedAt ? null : Date.now();
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError('퍼즐 데이터를 불러오는 중 문제가 생겼습니다.');
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session || session.completedAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      const previousTick = lastTickRef.current ?? now;
      const delta = now - previousTick;
      lastTickRef.current = now;
      setElapsedMs((current) => current + delta);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      savePuzzleSession({
        ...session,
        elapsedMs
      }).catch(() => {
        setError('자동 저장에 실패했습니다.');
      });
    }, 250);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [session, elapsedMs]);

  useEffect(() => {
    if (!session || !session.completedAt || completionHandledRef.current) {
      return;
    }

    completionHandledRef.current = true;
    const finalized = { ...session, elapsedMs };

    savePuzzleSession(finalized)
      .then(() => {
        navigate(`/complete/${encodeURIComponent(finalized.id)}`, { replace: true });
      })
      .catch(() => {
        setError('완료 상태를 저장하지 못했습니다.');
      });
  }, [elapsedMs, navigate, session]);

  useEffect(() => {
    if (!highlightedPieceId) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setHighlightedPieceId(null), 1400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedPieceId]);

  useEffect(() => {
    if (!loaded || !session) {
      return undefined;
    }

    const viewport = playViewportRef.current;

    if (!viewport) {
      return undefined;
    }

    const updateViewportSize = () => {
      const nextWidth = Math.round(viewport.getBoundingClientRect().width);
      const nextHeight = Math.round(viewport.getBoundingClientRect().height);

      setPlayViewportSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateViewportSize();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, [loaded, session]);

  const completionRatio = useMemo(() => {
    if (!session) {
      return 0;
    }

    return (
      session.pieces.filter((piece) => piece.fixed).length / Math.max(1, session.pieces.length)
    );
  }, [session]);

  if (!loaded) {
    return <main className="loading-shell">퍼즐을 준비하고 있습니다...</main>;
  }

  if (!session || error) {
    return (
      <main className="loading-shell">
        <p>{error ?? '퍼즐을 찾을 수 없습니다.'}</p>
      </main>
    );
  }

  return (
    <main className="play-shell">
      <PlaySidebar
        session={session}
        completionRatio={completionRatio}
        elapsedMs={elapsedMs}
        soundEnabled={enabled}
        onHint={() => {
          void play('hint');
          const hintResult = createHint(session);
          setHighlightedPieceId(hintResult.pieceId);
          setSession({
            ...hintResult.session,
            elapsedMs
          });
        }}
        onSeparateEdges={() => {
          void play('separate_edges');
          setSession({
            ...separateEdgePieces(session, session.definition),
            elapsedMs
          });
        }}
        onGoHome={() => {
          void play('ui_click');
          navigate('/');
        }}
        onToggleSound={() => {
          if (enabled) {
            void play('ui_click');
          }
          toggleEnabled();
        }}
      />
      <section className="board-panel">
        <div ref={playViewportRef} className="play-viewport" data-testid="play-viewport">
          <Suspense fallback={<div className="board-frame loading-shell">보드를 준비하는 중입니다...</div>}>
            <PuzzleBoard
              session={session}
              highlightedPieceId={highlightedPieceId}
              viewport={playViewportSize}
              onPlaySound={(soundId) => {
                void play(soundId);
              }}
              onSessionChange={(nextSession) => {
                setSession({ ...nextSession, elapsedMs });
              }}
            />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

export function CompleteRoute() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const { play } = useSound();
  const [session, setSession] = useState<PuzzleSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    createStorage()
      .then((storage) => storage.getSession(sessionId))
      .then((storedSession) => {
        if (!cancelled) {
          setSession(storedSession ?? null);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!loaded) {
    return <main className="loading-shell">결과를 불러오는 중입니다...</main>;
  }

  if (!session) {
    return <main className="loading-shell">완료한 퍼즐을 찾을 수 없습니다.</main>;
  }

  return (
    <CompletePage
      session={session}
      onUiClick={() => {
        void play('ui_click');
      }}
      onRestart={async () => {
        const source = makeSourceFromSession(session);
        const definition = createPuzzleDefinition(source, session.definition.preset);
        const nextSession = createPuzzleSession(definition);
        await savePuzzleSession(nextSession);
        navigate(`/play/${encodeURIComponent(nextSession.id)}`);
      }}
    />
  );
}
