import type { SoundId } from './soundRegistry';

interface ResolveBoardDragEndSoundsInput {
  didSnap: boolean;
  wasCompletedBefore: boolean;
  isCompletedNow: boolean;
}

export function resolveBoardDragEndSounds({
  didSnap,
  wasCompletedBefore,
  isCompletedNow
}: ResolveBoardDragEndSoundsInput): SoundId[] {
  if (!didSnap) {
    return ['piece_drop'];
  }

  if (!wasCompletedBefore && isCompletedNow) {
    return ['piece_snap', 'puzzle_complete'];
  }

  return ['piece_snap'];
}
