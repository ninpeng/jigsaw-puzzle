import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { SOUND_IDS, SOUND_REGISTRY } from '../src/app/audio/soundRegistry';

describe('audio assets', () => {
  it('ships every registered sound file in public/assets/audio', () => {
    SOUND_IDS.forEach((soundId) => {
      const absolutePath = resolve(
        process.cwd(),
        'public',
        SOUND_REGISTRY[soundId].src.replace(/^\//, '')
      );

      expect(existsSync(absolutePath)).toBe(true);
    });
  });
});
