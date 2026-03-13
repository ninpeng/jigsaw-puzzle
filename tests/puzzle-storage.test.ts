import 'fake-indexeddb/auto';

import {
  DIFFICULTY_PRESETS,
  createPuzzleDefinition,
  createPuzzleSession,
  createStorage,
  resetStorage,
  savePuzzleSession,
  savePuzzleSource
} from '../src/puzzle';
import type { PuzzleSource } from '../src/puzzle';

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
  });
});
