# Responsive Playfield Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the play screen so Phaser computes a responsive board/tray layout from the actual container size, while puzzle state is stored in layout-independent terms and restored consistently across desktop, tablet, and mobile.

**Architecture:** Keep React as the app shell and make Phaser the authority for play-screen geometry. Replace absolute stored piece coordinates with semantic placement data (`zone`, `traySlotIndex`, `boardPosition`) so the scene can reproject pieces into the current responsive layout on each load and resize.

**Tech Stack:** React 19, TypeScript, Phaser 3, Vitest, Testing Library, IndexedDB via `idb`

---

### Task 1: Introduce responsive layout primitives

**Files:**
- Create: `src/puzzle/layout.ts`
- Modify: `src/puzzle/index.ts`
- Test: `tests/puzzle-layout.test.ts`

**Step 1: Write the failing tests**

```ts
it('builds a desktop layout with a right tray', () => {
  const layout = buildPlayLayout({
    width: 1366,
    height: 900,
    trayCollapsed: false,
    pieceCount: 24,
    imageWidth: 1600,
    imageHeight: 900
  });

  expect(layout.mode).toBe('desktop');
  expect(layout.tray.rect.width).toBeGreaterThan(0);
  expect(layout.board.rect.width).toBeGreaterThan(layout.board.rect.height);
});
```

```ts
it('builds a mobile layout with a bottom drawer tray', () => {
  const layout = buildPlayLayout({
    width: 390,
    height: 844,
    trayCollapsed: true,
    pieceCount: 24,
    imageWidth: 1600,
    imageHeight: 900
  });

  expect(layout.mode).toBe('mobile');
  expect(layout.tray.rect.y).toBeGreaterThan(layout.board.rect.y);
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/puzzle-layout.test.ts`

Expected: FAIL because `src/puzzle/layout.ts` does not exist.

**Step 3: Write minimal implementation**

Create a layout builder that returns:

```ts
export interface PlayViewport {
  width: number;
  height: number;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayLayout {
  mode: 'desktop' | 'tablet' | 'mobile';
  board: { rect: LayoutRect };
  tray: { rect: LayoutRect; slots: LayoutRect[]; collapsed: boolean };
}
```

Implement `buildPlayLayout()` with simple mode thresholds and right-tray vs bottom-drawer geometry.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/puzzle-layout.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/puzzle/layout.ts src/puzzle/index.ts tests/puzzle-layout.test.ts
git commit -m "feat: add responsive playfield layout primitives"
```

### Task 2: Normalize persistent piece placement state

**Files:**
- Modify: `src/puzzle/types.ts`
- Modify: `src/puzzle/engine.ts`
- Test: `tests/puzzle-engine.test.ts`

**Step 1: Write the failing tests**

```ts
it('creates new sessions with loose pieces assigned to tray slots', () => {
  const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
  const session = createPuzzleSession(definition, { seed: 12 });

  expect(session.pieces.every((piece) => piece.fixed || piece.zone === 'tray')).toBe(true);
  expect(session.pieces.every((piece) => piece.fixed || piece.traySlotIndex !== null)).toBe(true);
});
```

```ts
it('stores loose board pieces with relative board coordinates', () => {
  const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
  const session = createPuzzleSession(definition, { seed: 12 });
  const target = session.pieces[0];

  const moved = updatePiecePlacement(session, target.id, {
    zone: 'board',
    boardPosition: { x: 0.45, y: 0.3 }
  });

  expect(moved.pieces[0].zone).toBe('board');
  expect(moved.pieces[0].boardPosition).toEqual({ x: 0.45, y: 0.3 });
  expect(moved.pieces[0].traySlotIndex).toBeNull();
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/puzzle-engine.test.ts -t "tray slots|relative board coordinates"`

Expected: FAIL because normalized placement fields and helpers do not exist yet.

**Step 3: Write minimal implementation**

Add a normalized piece-placement model:

```ts
export interface RelativeBoardPosition {
  x: number;
  y: number;
}

export interface PuzzlePieceState extends PuzzlePieceDefinition {
  fixed: boolean;
  zone: 'tray' | 'board';
  traySlotIndex: number | null;
  boardPosition: RelativeBoardPosition | null;
}
```

Initialize new sessions with tray slot indices. Add helper functions that update `zone`, `traySlotIndex`, and `boardPosition` without depending on hard-coded pixel geometry.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/puzzle-engine.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/puzzle/types.ts src/puzzle/engine.ts tests/puzzle-engine.test.ts
git commit -m "feat: normalize puzzle piece placement state"
```

### Task 3: Add legacy-session migration in storage

**Files:**
- Modify: `src/puzzle/storage.ts`
- Test: `tests/puzzle-storage.test.ts`

**Step 1: Write the failing test**

```ts
it('migrates legacy absolute-position sessions into normalized placement state', async () => {
  // seed a legacy-shaped session directly into storage
  // then read it back through createStorage().getSession()
  // assert tray pieces get slot indexes and board pieces get relative board positions
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/puzzle-storage.test.ts -t "migrates legacy absolute-position sessions"`

Expected: FAIL because storage does not migrate legacy sessions yet.

**Step 3: Write minimal implementation**

Add a migration layer in `storage.ts` that:
- detects old piece records with absolute `x/y`
- classifies in-board pieces as `zone: 'board'`
- maps out-of-board pieces to `zone: 'tray'`
- assigns tray slot indexes by stable order
- persists the normalized session back to IndexedDB

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/puzzle-storage.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/puzzle/storage.ts tests/puzzle-storage.test.ts
git commit -m "feat: migrate legacy sessions to responsive placement state"
```

### Task 4: Make PlayPage provide real container size to Phaser

**Files:**
- Modify: `src/app/routes/PlayPage.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/play-page.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders the play board inside a responsive full-size container', async () => {
  render(<PlayPage />);
  expect(screen.getByTestId('play-viewport')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/play-page.test.tsx`

Expected: FAIL because the responsive viewport wrapper and test file do not exist yet.

**Step 3: Write minimal implementation**

Add a measured play viewport container with `ResizeObserver` support:

```tsx
<section className="board-panel" data-testid="play-viewport">
  <PuzzleBoard viewport={viewport} ... />
</section>
```

Update layout CSS so the play screen uses the available viewport instead of a fixed `760px` minimum board area.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/play-page.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/routes/PlayPage.tsx src/app/styles.css tests/play-page.test.tsx
git commit -m "feat: pass responsive viewport size into play board"
```

### Task 5: Rebuild PuzzleBoard around responsive Phaser layout

**Files:**
- Modify: `src/app/ui/PuzzleBoard.tsx`
- Modify: `src/app/audio/boardSound.ts` if drag-end semantics need adjustment
- Test: `tests/puzzle-board.test.tsx`
- Test: `tests/board-sound.test.ts`

**Step 1: Write the failing tests**

```tsx
it('renders board and tray using the current responsive layout mode', async () => {
  // mount PuzzleBoard with a desktop-sized viewport
  // assert desktop tray chrome is rendered
});
```

```tsx
it('switches to mobile drawer tray layout when viewport is narrow', async () => {
  // mount PuzzleBoard with mobile viewport
  // assert mobile tray chrome is rendered
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/puzzle-board.test.tsx tests/board-sound.test.ts`

Expected: FAIL because the board does not accept responsive layout input yet.

**Step 3: Write minimal implementation**

Update Phaser scene to:
- accept a `viewport` prop
- call `buildPlayLayout()`
- render board/tray chrome from layout rects
- map normalized session state into pixel positions
- update normalized placement state on drag/drop/snap
- preserve existing sound behavior
- redraw board outlines from the recomputed board rect

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/puzzle-board.test.tsx tests/board-sound.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/ui/PuzzleBoard.tsx src/app/audio/boardSound.ts tests/puzzle-board.test.tsx tests/board-sound.test.ts
git commit -m "feat: render responsive Phaser playfield"
```

### Task 6: Add tray interaction semantics for desktop/tablet and mobile

**Files:**
- Modify: `src/app/routes/PlaySidebar.tsx`
- Modify: `src/app/routes/PlayPage.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/play-sidebar.test.tsx`

**Step 1: Write the failing tests**

```tsx
it('toggles the desktop tray from the sidebar controls', async () => {
  // assert tray toggle callback and label
});
```

```tsx
it('shows a drawer-style tray toggle in mobile mode', async () => {
  // assert mobile label and callback wiring
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/play-sidebar.test.tsx`

Expected: FAIL because the responsive tray control API does not exist yet.

**Step 3: Write minimal implementation**

Expose:
- tray collapsed/open toggle
- `자동 재정렬`
- `가장자리 분리`

Keep the same actions, but make their labels and layout adapt to the current device mode.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/play-sidebar.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/routes/PlaySidebar.tsx src/app/routes/PlayPage.tsx src/app/styles.css tests/play-sidebar.test.tsx
git commit -m "feat: add responsive tray controls"
```

### Task 7: Full regression verification

**Files:**
- Verify: `tests/home-page.test.tsx`
- Verify: `tests/complete-page.test.tsx`
- Verify: `tests/audio-assets.test.ts`
- Verify: `tests/upload-validation.test.ts`
- Verify: `tests/sound-provider.test.tsx`

**Step 1: Run focused regression tests**

Run: `pnpm test tests/home-page.test.tsx tests/complete-page.test.tsx tests/audio-assets.test.ts tests/upload-validation.test.ts tests/sound-provider.test.tsx`

Expected: PASS.

**Step 2: Run the full test suite**

Run: `pnpm test`

Expected: PASS.

**Step 3: Run the production build**

Run: `pnpm build`

Expected: PASS. Existing chunk-size warning remains acceptable unless a new build failure appears.

**Step 4: Commit**

```bash
git add src tests
git commit -m "test: verify responsive playfield integration"
```
