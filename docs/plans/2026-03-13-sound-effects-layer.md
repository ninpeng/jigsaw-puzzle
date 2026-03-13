# Sound Effects Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add high-quality file-based sound effects to the puzzle app with a global sound manager, mute toggle, and event wiring for core UI and gameplay actions.

**Architecture:** Keep sound logic out of screen components. Add a React `SoundProvider` that owns `AudioContext`, decodes short effect files from `public/assets/audio`, unlocks playback on first user gesture, and exposes a small `play(soundId)` API plus `enabled` state. Screen components emit semantic sound events only; they do not manage buffers or playback details.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Testing Library, Web Audio API, static `.ogg` assets in `public/`

---

### Task 1: Define the sound contract

**Files:**
- Create: `src/app/audio/soundIds.ts`
- Create: `src/app/audio/soundRegistry.ts`
- Test: `tests/sound-registry.test.ts`

**Step 1: Write the failing test**

```ts
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
    expect(SOUND_REGISTRY.piece_snap.src).toBe('/assets/audio/piece-snap.ogg');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/sound-registry.test.ts`
Expected: FAIL because `src/app/audio/soundRegistry.ts` does not exist.

**Step 3: Write minimal implementation**

```ts
export const SOUND_IDS = ['ui_click', 'puzzle_start', 'piece_pickup', 'piece_drop', 'piece_snap', 'hint', 'separate_edges', 'puzzle_complete'] as const;

export const SOUND_REGISTRY = {
  ui_click: { src: '/assets/audio/ui-click.ogg', volume: 0.58 },
  puzzle_start: { src: '/assets/audio/puzzle-start.ogg', volume: 0.62 },
  piece_pickup: { src: '/assets/audio/piece-pickup.ogg', volume: 0.48 },
  piece_drop: { src: '/assets/audio/piece-drop.ogg', volume: 0.5 },
  piece_snap: { src: '/assets/audio/piece-snap.ogg', volume: 0.66 },
  hint: { src: '/assets/audio/hint.ogg', volume: 0.56 },
  separate_edges: { src: '/assets/audio/separate-edges.ogg', volume: 0.54 },
  puzzle_complete: { src: '/assets/audio/puzzle-complete.ogg', volume: 0.74 }
} as const;
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/sound-registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/sound-registry.test.ts src/app/audio/soundIds.ts src/app/audio/soundRegistry.ts
git commit -m "feat: define puzzle sound registry"
```

### Task 2: Add a global sound manager and persisted mute state

**Files:**
- Create: `src/app/audio/SoundProvider.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/sound-provider.test.tsx`

**Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { SoundProvider, useSound } from '../src/app/audio/SoundProvider';

function Probe() {
  const { enabled, toggleEnabled, unlock } = useSound();
  return (
    <>
      <button onClick={unlock}>unlock</button>
      <button onClick={toggleEnabled}>toggle</button>
      <span>{enabled ? 'on' : 'off'}</span>
    </>
  );
}

describe('SoundProvider', () => {
  it('defaults to enabled and persists toggle state', () => {
    render(<SoundProvider><Probe /></SoundProvider>);
    expect(screen.getByText('on')).toBeInTheDocument();
    fireEvent.click(screen.getByText('toggle'));
    expect(localStorage.getItem('jigsaw-sound-enabled')).toBe('false');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/sound-provider.test.tsx`
Expected: FAIL because `SoundProvider` does not exist.

**Step 3: Write minimal implementation**

```tsx
const STORAGE_KEY = 'jigsaw-sound-enabled';

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'false');
  const audioContextRef = useRef<AudioContext | null>(null);

  const unlock = async () => {
    audioContextRef.current ??= new AudioContext();
    if (audioContextRef.current.state !== 'running') {
      await audioContextRef.current.resume();
    }
  };

  const toggleEnabled = () => {
    setEnabled((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return <SoundContext.Provider value={{ enabled, toggleEnabled, unlock, play: async () => {} }}>{children}</SoundContext.Provider>;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/sound-provider.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/sound-provider.test.tsx src/app/audio/SoundProvider.tsx src/app/App.tsx
git commit -m "feat: add global sound provider"
```

### Task 3: Decode effect files and expose `play(soundId)`

**Files:**
- Modify: `src/app/audio/SoundProvider.tsx`
- Modify: `src/app/audio/soundRegistry.ts`
- Test: `tests/sound-provider.test.tsx`

**Step 1: Write the failing test**

```tsx
it('does not attempt playback while muted', async () => {
  const playSpy = vi.fn();
  vi.stubGlobal('AudioContext', class {
    state = 'running';
    resume = vi.fn();
    decodeAudioData = vi.fn();
    createBufferSource = () => ({ connect: vi.fn(), start: playSpy });
    createGain = () => ({ connect: vi.fn(), gain: { value: 1 } });
    destination = {};
  });
  // render provider, mute it, call play('ui_click')
  expect(playSpy).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/sound-provider.test.tsx`
Expected: FAIL because `play(soundId)` is a no-op or mute logic is missing.

**Step 3: Write minimal implementation**

```tsx
const play = async (soundId: SoundId) => {
  if (!enabled) return;
  const context = await ensureUnlockedContext();
  const buffer = await loadBuffer(soundId, context);
  const source = context.createBufferSource();
  const gainNode = context.createGain();
  gainNode.gain.value = SOUND_REGISTRY[soundId].volume;
  source.buffer = buffer;
  source.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(0);
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/sound-provider.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/sound-provider.test.tsx src/app/audio/SoundProvider.tsx src/app/audio/soundRegistry.ts
git commit -m "feat: decode and play sound effect files"
```

### Task 4: Add a visible sound toggle to the home screen

**Files:**
- Modify: `src/app/routes/HomePage.tsx`
- Modify: `src/app/styles.css`
- Modify: `src/app/App.tsx`
- Test: `tests/home-page.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows the sound toggle and delegates state changes', () => {
  const onToggleSound = vi.fn();
  render(
    <HomePage
      /* existing props */
      soundEnabled
      onToggleSound={onToggleSound}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '사운드 켜짐' }));
  expect(onToggleSound).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/home-page.test.tsx`
Expected: FAIL because `HomePage` has no sound toggle props or button.

**Step 3: Write minimal implementation**

```tsx
<button
  type="button"
  className="ghost-button"
  aria-label={soundEnabled ? '사운드 켜짐' : '사운드 꺼짐'}
  onClick={onToggleSound}
>
  {soundEnabled ? '사운드 ON' : '사운드 OFF'}
</button>
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/home-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/home-page.test.tsx src/app/routes/HomePage.tsx src/app/styles.css src/app/App.tsx
git commit -m "feat: add home sound toggle"
```

### Task 5: Wire home and completion UI sounds

**Files:**
- Modify: `src/app/routes/HomePage.tsx`
- Modify: `src/app/routes/CompletePage.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/home-page.test.tsx`
- Test: `tests/complete-page.test.tsx`

**Step 1: Write the failing test**

```tsx
it('plays ui and start sounds for home actions', async () => {
  const play = vi.fn();
  // render HomePage with sound hook mocked
  fireEvent.click(screen.getByRole('button', { name: 'Aurora Lake 시작하기' }));
  expect(play).toHaveBeenCalledWith('ui_click');
  expect(play).toHaveBeenCalledWith('puzzle_start');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/home-page.test.tsx tests/complete-page.test.tsx`
Expected: FAIL because UI actions do not emit sound events.

**Step 3: Write minimal implementation**

```tsx
play('ui_click');
play('puzzle_start');
onStartPuzzle(source.id, selectedDifficulty.id);
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/home-page.test.tsx tests/complete-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/home-page.test.tsx tests/complete-page.test.tsx src/app/routes/HomePage.tsx src/app/routes/CompletePage.tsx src/app/App.tsx
git commit -m "feat: wire home and completion sound effects"
```

### Task 6: Wire play screen assist sounds

**Files:**
- Modify: `src/app/routes/PlayPage.tsx`
- Test: `tests/play-page-sound.test.tsx`

**Step 1: Write the failing test**

```tsx
it('plays the hint and edge sounds when assist buttons are used', async () => {
  const play = vi.fn();
  // render PlayPage with a seeded session and mocked sound hook
  fireEvent.click(screen.getByRole('button', { name: '힌트' }));
  fireEvent.click(screen.getByRole('button', { name: '가장자리 분리' }));
  expect(play).toHaveBeenCalledWith('hint');
  expect(play).toHaveBeenCalledWith('separate_edges');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/play-page-sound.test.tsx`
Expected: FAIL because play screen buttons do not call the sound manager.

**Step 3: Write minimal implementation**

```tsx
play('hint');
setSession({ ...hintResult.session, elapsedMs });

play('separate_edges');
setSession({ ...separateEdgePieces(session, session.definition), elapsedMs });
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/play-page-sound.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/play-page-sound.test.tsx src/app/routes/PlayPage.tsx
git commit -m "feat: add assist action sound effects"
```

### Task 7: Wire puzzle interaction and completion sounds

**Files:**
- Modify: `src/app/ui/PuzzleBoard.tsx`
- Modify: `src/app/routes/PlayPage.tsx`
- Test: `tests/puzzle-board-sound.test.ts`

**Step 1: Write the failing test**

```ts
it('emits pickup, drop, snap, and complete sound ids at the right times', () => {
  const play = vi.fn();
  // create scene adapter with injected play callback
  // dragstart => piece_pickup
  // dragend unsnapped => piece_drop
  // dragend snapped => piece_snap
  // final snapped piece => puzzle_complete once
  expect(play).toHaveBeenNthCalledWith(1, 'piece_pickup');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/puzzle-board-sound.test.ts`
Expected: FAIL because board events are not wired to sound callbacks.

**Step 3: Write minimal implementation**

```ts
this.playSound('piece_pickup');
if (result.didSnap) {
  this.playSound('piece_snap');
  if (result.session.completedAt && !previouslyCompleted) {
    this.playSound('puzzle_complete');
  }
} else {
  this.playSound('piece_drop');
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/puzzle-board-sound.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/puzzle-board-sound.test.ts src/app/ui/PuzzleBoard.tsx src/app/routes/PlayPage.tsx
git commit -m "feat: add board interaction sound effects"
```

### Task 8: Add the audio assets and final verification

**Files:**
- Create: `public/assets/audio/ui-click.ogg`
- Create: `public/assets/audio/puzzle-start.ogg`
- Create: `public/assets/audio/piece-pickup.ogg`
- Create: `public/assets/audio/piece-drop.ogg`
- Create: `public/assets/audio/piece-snap.ogg`
- Create: `public/assets/audio/hint.ogg`
- Create: `public/assets/audio/separate-edges.ogg`
- Create: `public/assets/audio/puzzle-complete.ogg`
- Modify: `index.html`

**Step 1: Write the failing check**

```ts
it('references only audio files that exist in public/assets/audio', () => {
  expect(() => SOUND_IDS.map((id) => SOUND_REGISTRY[id].src)).not.toThrow();
});
```

**Step 2: Run check to verify it fails**

Run: `pnpm build`
Expected: asset-related failure or runtime 404s until the audio files are added.

**Step 3: Add the minimal implementation**

```text
public/assets/audio/ui-click.ogg
public/assets/audio/puzzle-start.ogg
public/assets/audio/piece-pickup.ogg
public/assets/audio/piece-drop.ogg
public/assets/audio/piece-snap.ogg
public/assets/audio/hint.ogg
public/assets/audio/separate-edges.ogg
public/assets/audio/puzzle-complete.ogg
```

**Step 4: Run verification to verify it passes**

Run: `pnpm test && pnpm build`
Expected: all tests pass, production build succeeds, no missing audio asset requests in the browser.

**Step 5: Commit**

```bash
git add public/assets/audio index.html tests src/app/audio src/app/routes src/app/ui
git commit -m "feat: add puzzle sound effects layer"
```

### Manual Browser Check

Run the dev server and verify these exact behaviors:

- Home screen buttons make a short click sound.
- Starting a puzzle plays `ui_click` then `puzzle_start`.
- Dragging a piece plays pickup once.
- Releasing a piece without snap plays drop once.
- Snapping a piece plays snap once.
- The last successful snap plays the completion fanfare once.
- `힌트` and `가장자리 분리` each play the correct effect.
- Toggling sound off prevents all new sounds immediately.
- Refreshing the page preserves the sound on/off state.

### Notes

- If the workspace still lacks Git initialization, run the implementation tasks without the commit steps and initialize Git later. The implementation order and test order stay the same.
