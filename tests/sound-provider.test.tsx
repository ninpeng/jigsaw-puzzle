import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SoundProvider, useSound } from '../src/app/audio/SoundProvider';

const decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => ({ duration: buffer.byteLength }));
const resume = vi.fn(async () => undefined);
const start = vi.fn();

class MockAudioContext {
  state: AudioContextState = 'suspended';
  destination = {};
  decodeAudioData = decodeAudioData;
  resume = resume;
  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      gain: { value: 1 }
    };
  }
}

function Probe() {
  const { enabled, toggleEnabled, unlock, play } = useSound();

  return (
    <>
      <button type="button" onClick={() => void unlock()}>
        unlock
      </button>
      <button type="button" onClick={toggleEnabled}>
        toggle
      </button>
      <button type="button" onClick={() => void play('ui_click')}>
        play
      </button>
      <span>{enabled ? 'on' : 'off'}</span>
    </>
  );
}

describe('SoundProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    decodeAudioData.mockClear();
    resume.mockClear();
    start.mockClear();
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(32)
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to enabled and persists toggle state', () => {
    render(
      <SoundProvider>
        <Probe />
      </SoundProvider>
    );

    expect(screen.getByText('on')).toBeInTheDocument();

    fireEvent.click(screen.getByText('toggle'));

    expect(localStorage.getItem('jigsaw-bloom-sound-enabled')).toBe('false');
    expect(screen.getByText('off')).toBeInTheDocument();
  });

  it('does not attempt playback while muted', async () => {
    render(
      <SoundProvider>
        <Probe />
      </SoundProvider>
    );

    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByText('play'));

    await waitFor(() => {
      expect(start).not.toHaveBeenCalled();
    });
  });

  it('unlocks audio and plays a sound when enabled', async () => {
    render(
      <SoundProvider>
        <Probe />
      </SoundProvider>
    );

    fireEvent.click(screen.getByText('unlock'));
    fireEvent.click(screen.getByText('play'));

    await waitFor(() => {
      expect(resume).toHaveBeenCalled();
      expect(start).toHaveBeenCalled();
    });
  });
});
