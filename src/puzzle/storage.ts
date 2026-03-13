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
      return db.get(SESSION_STORE, id);
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
  await storage.saveSource(source);
}

export async function savePuzzleSession(session: PuzzleSession): Promise<void> {
  const storage = await createStorage();
  await storage.saveSession(session);
}

export async function resetStorage(): Promise<void> {
  await deleteDB(DATABASE_NAME);
}
