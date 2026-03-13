import { SOUND_IDS, SOUND_REGISTRY } from '../src/app/audio/soundRegistry';

describe('sound registry', () => {
  it('maps every public sound id to a concrete audio file', () => {
    expect(SOUND_IDS).toEqual([
      'ui_click',
      'puzzle_start',
      'piece_pickup',
      'piece_drop',
      'piece_snap',
      'hint',
      'separate_edges',
      'puzzle_complete'
    ]);
    expect(SOUND_REGISTRY.piece_snap.src).toBe('/assets/audio/piece-snap.wav');
  });
});
