import { deleteDB, openDB } from 'idb';

import type { PuzzleSession, PuzzleSessionSummary, PuzzleSource } from './types';

const DATABASE_NAME = 'jigsaw-puzzle-db';
const DATABASE_VERSION = 1;
const SOURCE_STORE = 'sources';
const SESSION_STORE = 'sessions';

type PuzzleDatabase = {
  [SOURCE_STORE]: {
    key: string;
    value: PuzzleSource;
  };
  [SESSION_STORE]: {
    key: string;
    value: PuzzleSession;
  };
};

type LegacyPiece = {
  id: string;
  x: number;
  y: number;
  zone?: unknown;
  traySlotIndex?: unknown;
  boardPosition?: unknown;
};

function isPointInsideBoard(
  definition: PuzzleSession['definition'],
  point: { x: number; y: number }
): boolean {
  return (
    point.x >= definition.board.x &&
    point.x <= definition.board.x + definition.board.width - definition.pieceWidth &&
    point.y >= definition.board.y &&
    point.y <= definition.board.y + definition.board.height - definition.pieceHeight
  );
}

function getBoardRelativePosition(
  definition: PuzzleSession['definition'],
  point: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (point.x - definition.board.x) / definition.board.width,
    y: (point.y - definition.board.y) / definition.board.height
  };
}

function compareLegacyTrayPieces(left: LegacyPiece, right: LegacyPiece): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  if (left.x !== right.x) {
    return left.x - right.x;
  }

  return left.id.localeCompare(right.id);
}

function isLegacyPiece(piece: LegacyPiece): boolean {
  return piece.zone === undefined || piece.traySlotIndex === undefined || piece.boardPosition === undefined;
}

function migrateLegacySession(session: PuzzleSession): PuzzleSession {
  if (!session.pieces.some((piece) => isLegacyPiece(piece))) {
    return session;
  }

  const migratedPieces = session.pieces.map((piece) => {
    const inBoard = isPointInsideBoard(session.definition, piece);

    return inBoard
      ? {
          ...piece,
          zone: 'board' as const,
          traySlotIndex: null,
          boardPosition: getBoardRelativePosition(session.definition, piece)
        }
      : {
          ...piece,
          zone: 'tray' as const,
          traySlotIndex: null,
          boardPosition: null
        };
  });

  const traySlotIndexes = new Map(
    migratedPieces
      .filter((piece) => piece.zone === 'tray')
      .sort(compareLegacyTrayPieces)
      .map((piece, index) => [piece.id, index])
  );

  return {
    ...session,
    pieces: migratedPieces.map((piece) =>
      piece.zone === 'tray'
        ? {
            ...piece,
            traySlotIndex: traySlotIndexes.get(piece.id) ?? null
          }
        : piece
    )
  };
}

export async function createStorage() {
  const db = await openDB<PuzzleDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(SOURCE_STORE)) {
        database.createObjectStore(SOURCE_STORE, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE, { keyPath: 'id' });
      }
    }
  });

  return {
    close(): void {
      db.close();
    },
    async getSource(id: string): Promise<PuzzleSource | undefined> {
      return db.get(SOURCE_STORE, id);
    },
    async listSources(): Promise<PuzzleSource[]> {
      return db.getAll(SOURCE_STORE);
    },
    async saveSource(source: PuzzleSource): Promise<void> {
      await db.put(SOURCE_STORE, source);
    },
    async getSession(id: string): Promise<PuzzleSession | undefined> {
      const session = await db.get(SESSION_STORE, id);

      if (!session) {
        return undefined;
      }

      const migratedSession = migrateLegacySession(session);

      if (migratedSession !== session) {
        await db.put(SESSION_STORE, migratedSession);
      }

      return migratedSession;
    },
    async listSessions(): Promise<PuzzleSessionSummary[]> {
      const sessions = await db.getAll(SESSION_STORE);

      return sessions
        .map((session) => ({
          id: session.id,
          sourceTitle: session.definition.sourceTitle,
          presetLabel: session.definition.preset.label,
          completionRatio:
            session.pieces.length === 0
              ? 0
              : session.pieces.filter((piece) => piece.fixed).length / session.pieces.length,
          lastUpdatedAt: session.lastUpdatedAt,
          completedAt: session.completedAt
        }))
        .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));
    },
    async saveSession(session: PuzzleSession): Promise<void> {
      await db.put(SESSION_STORE, session);
    },
    async deleteSession(id: string): Promise<void> {
      await db.delete(SESSION_STORE, id);
    }
  };
}

export async function savePuzzleSource(source: PuzzleSource): Promise<void> {
  const storage = await createStorage();
  try {
    await storage.saveSource(source);
  } finally {
    storage.close();
  }
}

export async function savePuzzleSession(session: PuzzleSession): Promise<void> {
  const storage = await createStorage();
  try {
    await storage.saveSession(session);
  } finally {
    storage.close();
  }
}

export async function resetStorage(): Promise<void> {
  await deleteDB(DATABASE_NAME);
}
