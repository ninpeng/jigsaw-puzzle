import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';

import {
  DIFFICULTY_PRESETS,
  createPuzzleDefinition,
  createPuzzleSession,
  createStorage,
  savePuzzleSession,
  savePuzzleSource,
  type DifficultyPreset,
  type PuzzleSessionSummary,
  type PuzzleSource
} from '../puzzle';
import { SoundProvider, useSound } from './audio/SoundProvider';
import { BUILT_IN_SOURCES } from './catalog';
import { HomePage } from './routes/HomePage';
import {
  finalizePendingUpload,
  prepareLocalPuzzleUpload,
  rotatePendingUpload,
  type PendingUploadImage
} from './upload';

const PlayPage = lazy(async () => {
  const module = await import('./routes/PlayPage');
  return { default: module.PlayPage };
});

const CompleteRoute = lazy(async () => {
  const module = await import('./routes/PlayPage');
  return { default: module.CompleteRoute };
});

interface HomeData {
  sources: PuzzleSource[];
  sessions: PuzzleSessionSummary[];
}

async function loadHomeData(): Promise<HomeData> {
  const storage = await createStorage();
  const [uploadedSources, sessions] = await Promise.all([
    storage.listSources(),
    storage.listSessions()
  ]);

  return {
    sources: [...BUILT_IN_SOURCES, ...uploadedSources],
    sessions
  };
}

function HomeRoute() {
  const navigate = useNavigate();
  const { enabled, play, toggleEnabled } = useSound();
  const [sources, setSources] = useState<PuzzleSource[]>(BUILT_IN_SOURCES);
  const [sessions, setSessions] = useState<PuzzleSessionSummary[]>([]);
  const [selectedDifficultyId, setSelectedDifficultyId] =
    useState<DifficultyPreset['id']>('easy');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUploadImage | null>(null);

  useEffect(() => {
    loadHomeData().then(({ sources: loadedSources, sessions: loadedSessions }) => {
      setSources(loadedSources);
      setSessions(loadedSessions);
    });
  }, []);

  const selectedDifficulty = useMemo(
    () => DIFFICULTY_PRESETS[selectedDifficultyId],
    [selectedDifficultyId]
  );

  async function refreshHomeData() {
    const homeData = await loadHomeData();
    setSources(homeData.sources);
    setSessions(homeData.sessions);
  }

  return (
    <HomePage
      sources={sources}
      sessions={sessions}
      selectedDifficulty={selectedDifficulty}
      soundEnabled={enabled}
      uploadError={uploadError}
      pendingUpload={pendingUpload}
      onDifficultyChange={setSelectedDifficultyId}
      onToggleSound={toggleEnabled}
      onUiClick={() => {
        void play('ui_click');
      }}
      onStartPuzzle={async (sourceId, difficultyId) => {
        const source = sources.find((candidate) => candidate.id === sourceId);

        if (!source) {
          setUploadError('선택한 퍼즐을 찾을 수 없습니다.');
          return;
        }

        const definition = createPuzzleDefinition(source, DIFFICULTY_PRESETS[difficultyId]);
        const session = createPuzzleSession(definition);

        await savePuzzleSession(session);
        void play('puzzle_start');
        navigate(`/play/${encodeURIComponent(session.id)}`);
      }}
      onResumeSession={(sessionId) => {
        navigate(`/play/${encodeURIComponent(sessionId)}`);
      }}
      onUploadFile={async (file) => {
        try {
          const preparedUpload = await prepareLocalPuzzleUpload(file);

          if (preparedUpload.kind === 'ready') {
            await savePuzzleSource(preparedUpload.source);
            await refreshHomeData();
            setPendingUpload(null);
          } else {
            setPendingUpload(preparedUpload.pendingUpload);
          }

          setUploadError(null);
        } catch (error) {
          setUploadError(
            error instanceof Error ? error.message : '업로드 이미지를 준비하지 못했습니다.'
          );
        }
      }}
      onRotatePendingUploadLeft={async () => {
        if (!pendingUpload) {
          return;
        }

        setPendingUpload(await rotatePendingUpload(pendingUpload, 'left'));
      }}
      onRotatePendingUploadRight={async () => {
        if (!pendingUpload) {
          return;
        }

        setPendingUpload(await rotatePendingUpload(pendingUpload, 'right'));
      }}
      onConfirmPendingUpload={async () => {
        if (!pendingUpload) {
          return;
        }

        const source = finalizePendingUpload(pendingUpload);
        await savePuzzleSource(source);
        await refreshHomeData();
        setPendingUpload(null);
      }}
      onCancelPendingUpload={() => {
        setPendingUpload(null);
      }}
    />
  );
}

export function App() {
  return (
    <SoundProvider>
      <BrowserRouter>
        <Suspense fallback={<main className="loading-shell">퍼즐 화면을 여는 중입니다...</main>}>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/play/:sessionId" element={<PlayPage />} />
            <Route path="/complete/:sessionId" element={<CompleteRoute />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SoundProvider>
  );
}
