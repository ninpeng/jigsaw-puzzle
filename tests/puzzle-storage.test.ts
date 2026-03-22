import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { vi } from 'vitest';

import {
  DIFFICULTY_PRESETS,
  createPuzzleDefinition,
  createPuzzleSession,
  createStorage,
  resetStorage,
  savePuzzleSession,
  savePuzzleSource
} from '../src/puzzle';
import type { PuzzleSession, PuzzleSource } from '../src/puzzle';

const DATABASE_NAME = 'jigsaw-puzzle-db';
const SESSION_STORE = 'sessions';

const source: PuzzleSource = {
  id: 'upload-forest',
  type: 'local_upload',
  title: 'Forest',
  imageDataUrl: 'data:image/png;base64,AAAA',
  thumbnailDataUrl: 'data:image/png;base64,AAAA',
  imageWidth: 1280,
  imageHeight: 720
};

describe('puzzle storage', () => {
  beforeEach(async () => {
    await resetStorage();
  });

  it('persists uploaded puzzle sources and resumable sessions', async () => {
    await savePuzzleSource(source);
    const definition = createPuzzleDefinition(source, DIFFICULTY_PRESETS.medium);
    const session = createPuzzleSession(definition, { seed: 3 });

    await savePuzzleSession(session);

    const storage = await createStorage();
    try {
      const storedSource = await storage.getSource(source.id);
      const storedSession = await storage.getSession(session.id);
      const summaries = await storage.listSessions();

      expect(storedSource?.title).toBe('Forest');
      expect(storedSession?.definition.id).toBe(definition.id);
      expect(summaries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: session.id,
            completionRatio: 0
          })
        ])
      );
    } finally {
      storage.close();
    }
  });

  it('migrates legacy sessions with absolute piece positions on read', async () => {
    const definition = createPuzzleDefinition(source, DIFFICULTY_PRESETS.medium);
    const [boardPiece, trayPieceB, trayPieceA] = definition.pieces;
    const expectedBoardPosition = {
      x: 12 / definition.board.width,
      y: 16 / definition.board.height
    };
    const legacySession = {
      id: 'legacy-session',
      definition,
      pieces: [
        {
          ...boardPiece,
          x: definition.board.x + 12,
          y: definition.board.y + 16,
          fixed: false
        },
        {
          ...trayPieceB,
          x: 980,
          y: 120,
          fixed: false
        },
        {
          ...trayPieceA,
          x: 40,
          y: 420,
          fixed: false
        }
      ],
      startedAt: '2026-03-22T00:00:00.000Z',
      lastUpdatedAt: '2026-03-22T00:00:00.000Z',
      elapsedMs: 0,
      completedAt: null,
      assistActions: [],
      trayCollapsed: false
    } as unknown as PuzzleSession;

    await savePuzzleSession(legacySession);

    const storage = await createStorage();
    const rawDb = await openDB(DATABASE_NAME, 1);
    try {
      const migrated = await storage.getSession(legacySession.id);
      const storedSession = (await rawDb.get(SESSION_STORE, legacySession.id)) as
        | PuzzleSession
        | undefined;

      expect(migrated).toBeDefined();
      expect(migrated?.pieces[0]).toMatchObject({
        zone: 'board',
        traySlotIndex: null,
        boardPosition: expectedBoardPosition
      });
      expect(migrated?.pieces[1]).toMatchObject({
        zone: 'tray',
        traySlotIndex: 0,
        boardPosition: null
      });
      expect(migrated?.pieces[2]).toMatchObject({
        zone: 'tray',
        traySlotIndex: 1,
        boardPosition: null
      });
      expect(storedSession?.pieces[0]).toMatchObject({
        zone: 'board',
        traySlotIndex: null,
        boardPosition: expectedBoardPosition
      });
      expect(storedSession?.pieces[1]).toMatchObject({
        zone: 'tray',
        traySlotIndex: 0,
        boardPosition: null
      });
      expect(storedSession?.pieces[2]).toMatchObject({
        zone: 'tray',
        traySlotIndex: 1,
        boardPosition: null
      });
    } finally {
      rawDb.close();
      storage.close();
    }
  });

  it('returns the migrated legacy session when write-back fails', async () => {
    const definition = createPuzzleDefinition(source, DIFFICULTY_PRESETS.medium);
    const legacySession = {
      id: 'legacy-writeback-failure',
      definition,
      pieces: [
        {
          ...definition.pieces[0],
          x: definition.board.x + 12,
          y: definition.board.y + 16,
          fixed: false
        }
      ],
      startedAt: '2026-03-22T00:00:00.000Z',
      lastUpdatedAt: '2026-03-22T00:00:00.000Z',
      elapsedMs: 0,
      completedAt: null,
      assistActions: [],
      trayCollapsed: false
    } as unknown as PuzzleSession;

    await savePuzzleSession(legacySession);

    const storage = await createStorage();
    const putError = new Error('write-back failed');
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw putError;
    });

    try {
      await expect(storage.getSession(legacySession.id)).resolves.toMatchObject({
        id: legacySession.id,
        pieces: [
          expect.objectContaining({
            zone: 'board',
            traySlotIndex: null,
            boardPosition: {
              x: 12 / definition.board.width,
              y: 16 / definition.board.height
            }
          })
        ]
      });
    } finally {
      putSpy.mockRestore();
      storage.close();
    }
  });
});
