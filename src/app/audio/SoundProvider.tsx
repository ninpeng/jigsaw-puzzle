import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { SOUND_REGISTRY, type SoundId } from './soundRegistry';

const STORAGE_KEY = 'jigsaw-bloom-sound-enabled';

interface SoundContextValue {
  enabled: boolean;
  play: (soundId: SoundId) => Promise<void>;
  toggleEnabled: () => void;
  unlock: () => Promise<void>;
}

const SoundContext = createContext<SoundContextValue | null>(null);

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

export function SoundProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) !== 'false');
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Partial<Record<SoundId, AudioBuffer>>>({});
  const pendingLoadsRef = useRef<Partial<Record<SoundId, Promise<AudioBuffer>>>>({});

  const unlock = useCallback(async () => {
    audioContextRef.current ??= createAudioContext();

    if (!audioContextRef.current) {
      return;
    }

    if (audioContextRef.current.state !== 'running') {
      await audioContextRef.current.resume();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      void unlock();
    };

    window.addEventListener('pointerdown', handler, { passive: true });
    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [unlock]);

  const loadBuffer = useCallback(
    async (soundId: SoundId, context: AudioContext): Promise<AudioBuffer> => {
      const existingBuffer = bufferCacheRef.current[soundId];

      if (existingBuffer) {
        return existingBuffer;
      }

      const pendingLoad = pendingLoadsRef.current[soundId];

      if (pendingLoad) {
        return pendingLoad;
      }

      const request = fetch(SOUND_REGISTRY[soundId].src)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load sound: ${soundId}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          return context.decodeAudioData(arrayBuffer.slice(0));
        })
        .then((buffer) => {
          bufferCacheRef.current[soundId] = buffer;
          delete pendingLoadsRef.current[soundId];
          return buffer;
        })
        .catch((error) => {
          delete pendingLoadsRef.current[soundId];
          throw error;
        });

      pendingLoadsRef.current[soundId] = request;
      return request;
    },
    []
  );

  const play = useCallback(
    async (soundId: SoundId) => {
      if (!enabled) {
        return;
      }

      try {
        await unlock();
        const context = audioContextRef.current;

        if (!context) {
          return;
        }

        const buffer = await loadBuffer(soundId, context);
        const source = context.createBufferSource();
        const gainNode = context.createGain();

        source.buffer = buffer;
        gainNode.gain.value = SOUND_REGISTRY[soundId].volume;
        source.connect(gainNode);
        gainNode.connect(context.destination);
        source.start(0);
      } catch {
        return;
      }
    },
    [enabled, loadBuffer, unlock]
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      enabled,
      play,
      toggleEnabled,
      unlock
    }),
    [enabled, play, toggleEnabled, unlock]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const context = useContext(SoundContext);

  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }

  return context;
}
