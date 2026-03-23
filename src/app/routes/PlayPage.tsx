import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  createHint,
  createPuzzleDefinition,
  createPuzzleSession,
  createStorage,
  savePuzzleSession,
  separateEdgePieces,
  buildPlayLayout,
  type PuzzleSession,
  type PuzzleSource
} from '../../puzzle';
import { useSound } from '../audio/SoundProvider';
import { CompletePage } from './CompletePage';
import { PlayHud } from './PlayHud';

const PuzzleBoard = lazy(async () => {
  const module = await import('../ui/PuzzleBoard');
  return { default: module.PuzzleBoard };
});

const DEFAULT_PAGE_PADDING = 18;
const COMPACT_PAGE_PADDING = 12;
const COMPACT_PAGE_BREAKPOINT = 960;
const BOARD_PANEL_PADDING = 10;
const PLAY_SHELL_GAP = 12;
const DEFAULT_HUD_HEIGHT = 86;
const STACKED_HUD_HEIGHT = 110;
const COMPACT_HUD_HEIGHT = 126;
const STACKED_HUD_BREAKPOINT = 1200;
const MIN_BOARD_PANEL_HEIGHT = 360;

function resolveHudReserveHeight(windowWidth: number) {
  if (windowWidth <= COMPACT_PAGE_BREAKPOINT) {
    return COMPACT_HUD_HEIGHT;
  }

  if (windowWidth <= STACKED_HUD_BREAKPOINT) {
    return STACKED_HUD_HEIGHT;
  }

  return DEFAULT_HUD_HEIGHT;
}

function resolveBoardPanelHeight(windowWidth: number, windowHeight: number, hudHeight?: number) {
  const shellPadding =
    windowWidth <= COMPACT_PAGE_BREAKPOINT ? COMPACT_PAGE_PADDING : DEFAULT_PAGE_PADDING;
  const reservedHudHeight = hudHeight ?? resolveHudReserveHeight(windowWidth);

  return Math.max(
    MIN_BOARD_PANEL_HEIGHT,
    windowHeight - shellPadding * 2 - PLAY_SHELL_GAP - reservedHudHeight
  );
}

function shouldBlockPortraitPlay(windowWidth: number, windowHeight: number) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(pointer: coarse)').matches && windowHeight > windowWidth;
}

function toAbsoluteRectStyle(rect: { x: number; y: number; width: number; height: number }) {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  };
}

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
  const [boardPanelHeight, setBoardPanelHeight] = useState(() =>
    typeof window === 'undefined'
      ? 0
      : resolveBoardPanelHeight(
          window.innerWidth,
          window.innerHeight,
          resolveHudReserveHeight(window.innerWidth)
        )
  );
  const [portraitGuardActive, setPortraitGuardActive] = useState(() =>
    typeof window === 'undefined'
      ? false
      : shouldBlockPortraitPlay(window.innerWidth, window.innerHeight)
  );
  const [playViewportSize, setPlayViewportSize] = useState({ width: 0, height: 0 });
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentTrayPage, setCurrentTrayPage] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const lastTickRef = useRef<number | null>(null);
  const hudRef = useRef<HTMLElement | null>(null);
  const boardPanelRef = useRef<HTMLElement | null>(null);
  const playViewportRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const completionHandledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateWindowLayout = () => {
      const nextHudHeight =
        hudRef.current?.getBoundingClientRect().height ?? resolveHudReserveHeight(window.innerWidth);

      setBoardPanelHeight(resolveBoardPanelHeight(window.innerWidth, window.innerHeight, nextHudHeight));
      setPortraitGuardActive(shouldBlockPortraitPlay(window.innerWidth, window.innerHeight));
    };

    updateWindowLayout();
    window.addEventListener('resize', updateWindowLayout);

    return () => {
      window.removeEventListener('resize', updateWindowLayout);
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !hudRef.current) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      const nextHudHeight = hudRef.current?.getBoundingClientRect().height;

      if (!nextHudHeight) {
        return;
      }

      setBoardPanelHeight(resolveBoardPanelHeight(window.innerWidth, window.innerHeight, nextHudHeight));
    });

    observer.observe(hudRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loaded, portraitGuardActive]);

  useEffect(() => {
    if (typeof window === 'undefined' || portraitGuardActive || !hudRef.current) {
      return;
    }

    const nextHudHeight =
      hudRef.current.getBoundingClientRect().height || resolveHudReserveHeight(window.innerWidth);

    setBoardPanelHeight(resolveBoardPanelHeight(window.innerWidth, window.innerHeight, nextHudHeight));
  }, [loaded, portraitGuardActive, session, toolsOpen]);

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

  const playLayout = useMemo(() => {
    if (!session || playViewportSize.width <= 0 || playViewportSize.height <= 0) {
      return null;
    }

    const looseTrayPieceCount = session.pieces.filter(
      (piece) => !piece.fixed && piece.zone === 'tray' && piece.traySlotIndex !== null
    ).length;

    return buildPlayLayout({
      width: playViewportSize.width,
      height: playViewportSize.height,
      trayCollapsed: session.trayCollapsed,
      pieceCount: looseTrayPieceCount,
      imageWidth: session.definition.imageWidth,
      imageHeight: session.definition.imageHeight
    });
  }, [playViewportSize.height, playViewportSize.width, session]);

  const trayPageCount = playLayout?.tray.pageCount ?? 0;

  useEffect(() => {
    if (trayPageCount <= 0) {
      setCurrentTrayPage(0);
      return;
    }

    setCurrentTrayPage((current) => Math.min(current, trayPageCount - 1));
  }, [trayPageCount]);

  useEffect(() => {
    if (!loaded || !session || portraitGuardActive) {
      return undefined;
    }

    const boardPanel = boardPanelRef.current;
    const viewport = playViewportRef.current;

    if (!boardPanel || !viewport) {
      return undefined;
    }

    const updateViewportSize = () => {
      const nextWidth = Math.round(viewport.getBoundingClientRect().width);
      const nextHeight = Math.max(1, boardPanelHeight - BOARD_PANEL_PADDING * 2);

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

    observer.observe(boardPanel);

    return () => {
      observer.disconnect();
    };
  }, [boardPanelHeight, loaded, portraitGuardActive, session]);

  const completionRatio = useMemo(() => {
    if (!session) {
      return 0;
    }

    return (
      session.pieces.filter((piece) => piece.fixed).length / Math.max(1, session.pieces.length)
    );
  }, [session]);

  useEffect(() => {
    const gameWindow = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
    };

    gameWindow.render_game_to_text = () =>
      JSON.stringify({
        mode: portraitGuardActive ? 'rotation-guard' : 'play',
        sessionId,
        sourceTitle: session?.definition.sourceTitle ?? null,
        trayCollapsed: session?.trayCollapsed ?? null,
        trayPage: currentTrayPage,
        trayPageCount,
        referenceOpen,
        toolsOpen,
        completionRatio: Number(completionRatio.toFixed(3)),
        viewport: playViewportSize,
        board: playLayout?.board.rect ?? null
      });

    gameWindow.advanceTime = (ms: number) => {
      setElapsedMs((current) => current + Math.max(0, ms));
    };

    return () => {
      delete gameWindow.render_game_to_text;
      delete gameWindow.advanceTime;
    };
  }, [
    completionRatio,
    currentTrayPage,
    playLayout,
    playViewportSize,
    portraitGuardActive,
    referenceOpen,
    session,
    sessionId,
    toolsOpen,
    trayPageCount
  ]);

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

  if (portraitGuardActive) {
    return (
      <main className="rotation-shell">
        <section className="rotation-card">
          <span className="eyebrow">Landscape Only</span>
          <h1>가로 모드로 돌려주세요.</h1>
          <p>
            모바일 플레이는 가로 화면만 지원합니다. 기기를 돌리면 더 넓은 보드와 트레이를
            안정적으로 사용할 수 있습니다.
          </p>
          <div className="rotation-actions">
            <button
              type="button"
              className="accent-button"
              onClick={() => {
                void play('ui_click');
                navigate('/');
              }}
            >
              홈으로
            </button>
            <button
              type="button"
              className="secondary-button"
              aria-label={enabled ? '사운드 켜짐' : '사운드 꺼짐'}
              onClick={() => {
                if (enabled) {
                  void play('ui_click');
                }
                toggleEnabled();
              }}
            >
              {enabled ? '사운드 ON' : '사운드 OFF'}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="play-shell">
      <PlayHud
        ref={hudRef}
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
        toolsOpen={toolsOpen}
        onToggleTools={() => {
          setToolsOpen((current) => !current);
        }}
        onSeparateEdges={() => {
          void play('separate_edges');
          setToolsOpen(false);
          setSession({
            ...separateEdgePieces(session, session.definition),
            elapsedMs
          });
        }}
        onToggleReference={() => {
          setToolsOpen(false);
          setReferenceOpen((current) => !current);
        }}
      />
      <section
        ref={boardPanelRef}
        className="board-panel"
        data-testid="board-panel"
        style={boardPanelHeight > 0 ? { height: `${boardPanelHeight}px` } : undefined}
      >
        <div ref={playViewportRef} className="play-viewport" data-testid="play-viewport">
          <Suspense fallback={<div className="board-frame loading-shell">보드를 준비하는 중입니다...</div>}>
            <PuzzleBoard
              session={session}
              highlightedPieceId={highlightedPieceId}
              viewport={playViewportSize}
              currentTrayPage={currentTrayPage}
              onRequestPreviousTrayPage={() => {
                setCurrentTrayPage((current) => Math.max(0, current - 1));
              }}
              onRequestNextTrayPage={() => {
                setCurrentTrayPage((current) =>
                  Math.min(Math.max(0, trayPageCount - 1), current + 1)
                );
              }}
              onPlaySound={(soundId) => {
                void play(soundId);
              }}
              onSessionChange={(nextSession) => {
                setSession({ ...nextSession, elapsedMs });
              }}
            />
          </Suspense>
          {playLayout ? (
            <>
              <div
                className={`tray-handle ${session.trayCollapsed ? 'is-collapsed' : ''}`}
                data-testid="tray-handle"
                style={toAbsoluteRectStyle(playLayout.tray.handleRect)}
              >
                <button
                  type="button"
                  className="tray-handle-button"
                  aria-label={session.trayCollapsed ? '트레이 열기' : '트레이 접기'}
                  onClick={() => {
                    setSession({
                      ...session,
                      trayCollapsed: !session.trayCollapsed,
                      elapsedMs
                    });
                  }}
                >
                  {session.trayCollapsed ? '⟨' : '⟩'}
                </button>
              </div>
              {!session.trayCollapsed && trayPageCount > 1 ? (
                <div className="tray-page-dock" style={toAbsoluteRectStyle(playLayout.tray.rect)}>
                  <div className="tray-page-status">
                    <span>트레이 페이지</span>
                    <strong>
                      {currentTrayPage + 1} / {trayPageCount}
                    </strong>
                  </div>
                  <div className="tray-page-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setCurrentTrayPage((current) => Math.max(0, current - 1));
                      }}
                      disabled={currentTrayPage <= 0}
                    >
                      이전 페이지
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setCurrentTrayPage((current) =>
                          Math.min(Math.max(0, trayPageCount - 1), current + 1)
                        );
                      }}
                      disabled={currentTrayPage >= trayPageCount - 1}
                    >
                      다음 페이지
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
          {referenceOpen ? (
            <aside className="reference-popover">
              <div className="reference-popover-header">
                <strong>원본 보기</strong>
                <button
                  type="button"
                  className="ghost-button"
                  aria-label="원본 보기 닫기"
                  onClick={() => {
                    setReferenceOpen(false);
                  }}
                >
                  닫기
                </button>
              </div>
              <img
                src={session.definition.thumbnailDataUrl}
                alt={`${session.definition.sourceTitle} reference`}
              />
            </aside>
          ) : null}
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
