import { resolveBoardDragEndSounds } from '../src/app/audio/boardSound';

describe('resolveBoardDragEndSounds', () => {
  it('plays a drop sound when the piece does not snap', () => {
    expect(
      resolveBoardDragEndSounds({
        didSnap: false,
        wasCompletedBefore: false,
        isCompletedNow: false
      })
    ).toEqual(['piece_drop']);
  });

  it('plays snap and completion on the final successful snap', () => {
    expect(
      resolveBoardDragEndSounds({
        didSnap: true,
        wasCompletedBefore: false,
        isCompletedNow: true
      })
    ).toEqual(['piece_snap', 'puzzle_complete']);
  });
});
