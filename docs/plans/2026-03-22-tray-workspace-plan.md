# Tray Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible right-side tray, tray-based loose-piece management, subtle board outlines, and a tray reflow action without breaking the current save, sound, and completion flows.

**Architecture:** Keep the React shell responsible for control state and keep Phaser responsible for piece rendering and interaction. Extend the engine with tray-aware session data so the board scene can stay thin: it should render what the session already describes, then report updated positions back to React for autosave.

**Tech Stack:** React 19, TypeScript, Phaser 3, Vitest, Testing Library, IndexedDB via `idb`

---

### Task 1: Add tray-aware session types and engine helpers

**Files:**
- Modify: `src/puzzle/types.ts`
- Modify: `src/puzzle/engine.ts`
- Test: `tests/puzzle-engine.test.ts`

**Step 1: Write the failing test**

```ts
it('creates new sessions with every loose piece placed in the tray', () => {
  const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
  const session = createPuzzleSession(definition, { seed: 12 });

  expect(session.trayCollapsed).toBe(false);
  expect(session.pieces.every((piece) => piece.fixed || piece.zone === 'tray')).toBe(true);
  expect(session.pieces.every((piece) => piece.fixed || piece.y >= definition.board.y)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/puzzle-engine.test.ts -t "creates new sessions with every loose piece placed in the tray"`

Expected: FAIL because `trayCollapsed` and `piece.zone` do not exist yet.

**Step 3: Write minimal implementation**

```ts
export type PieceZone = 'board' | 'tray';

export interface PuzzlePieceState extends PuzzlePieceDefinition {
  x: number;
  y: number;
  fixed: boolean;
  zone: PieceZone;
}

export interface PuzzleSession {
  // existing fields...
  trayCollapsed: boolean;
}
```

```ts
function buildTraySlotPosition(index: number, definition: PuzzleDefinition): Point {
  const columns = Math.max(2, Math.floor(240 / (definition.pieceWidth + 12)));
  return {
    x: definition.board.x + definition.board.width + 36 + (index % columns) * (definition.pieceWidth + 12),
    y: definition.board.y + 24 + Math.floor(index / columns) * (definition.pieceHeight + 12)
  };
}

function buildSessionPiece(
  definitionPiece: PuzzlePieceDefinition,
  trayIndex: number,
  definition: PuzzleDefinition
): PuzzlePieceState {
  const slot = buildTraySlotPosition(trayIndex, definition);
  return {
    ...definitionPiece,
    x: slot.x,
    y: slot.y,
    fixed: false,
    zone: 'tray'
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/puzzle-engine.test.ts -t "creates new sessions with every loose piece placed in the tray"`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/puzzle-engine.test.ts src/puzzle/types.ts src/puzzle/engine.ts
git commit -m "feat: add tray-aware puzzle sessions"
```

### Task 2: Add tray reflow and edge-first ordering in the engine

**Files:**
- Modify: `src/puzzle/engine.ts`
- Modify: `src/puzzle/index.ts`
- Test: `tests/puzzle-engine.test.ts`

**Step 1: Write the failing tests**

```ts
it('returns every loose board piece back to tray slots when rearranging', () => {
  const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
  const session = createPuzzleSession(definition, { seed: 3 });
  const piece = session.pieces.find((candidate) => !candidate.fixed)!;

  piece.zone = 'board';
  piece.x = piece.homeX + 90;
  piece.y = piece.homeY + 40;

  const rearranged = rearrangeLoosePieces(session, definition);

  expect(rearranged.pieces.find((candidate) => candidate.id === piece.id)).toMatchObject({
    zone: 'tray'
  });
});

it('packs edge pieces first when separating tray pieces', () => {
  const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
  const session = createPuzzleSession(definition, { seed: 4 });

  const arranged = separateEdgePieces(session, definition);
  const loosePieces = arranged.pieces.filter((piece) => !piece.fixed);
  const firstInnerIndex = loosePieces.findIndex((piece) => !piece.isEdge);
  const lastEdgeIndex = loosePieces.reduce((index, piece, candidateIndex) => piece.isEdge ? candidateIndex : index, -1);

  expect(lastEdgeIndex).toBeLessThan(firstInnerIndex);
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/puzzle-engine.test.ts -t "rearranging|packs edge pieces first"`

Expected: FAIL because `rearrangeLoosePieces` does not exist and `separateEdgePieces` does not tray-sort yet.

**Step 3: Write minimal implementation**

```ts
function assignLoosePiecesToTray(
  session: PuzzleSession,
  definition: PuzzleDefinition,
  sort: (piece: PuzzlePieceState) => number
) {
  const loosePieces = [...session.pieces]
    .filter((piece) => !piece.fixed)
    .sort((left, right) => sort(left) - sort(right));

  loosePieces.forEach((piece, index) => {
    const slot = buildTraySlotPosition(index, definition);
    piece.x = slot.x;
    piece.y = slot.y;
    piece.zone = 'tray';
  });
}

export function rearrangeLoosePieces(session: PuzzleSession, definition: PuzzleDefinition): PuzzleSession {
  const nextSession = cloneSession(session);
  assignLoosePiecesToTray(nextSession, definition, () => 0);
  nextSession.lastUpdatedAt = nowIso();
  return nextSession;
}

export function separateEdgePieces(session: PuzzleSession, definition: PuzzleDefinition): PuzzleSession {
  const nextSession = cloneSession(session);
  assignLoosePiecesToTray(nextSession, definition, (piece) => (piece.isEdge ? 0 : 1));
  nextSession.assistActions.push({ type: 'separate_edges', timestamp: nowIso() });
  nextSession.lastUpdatedAt = nowIso();
  return nextSession;
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/puzzle-engine.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/puzzle-engine.test.ts src/puzzle/engine.ts src/puzzle/index.ts
git commit -m "feat: add tray reflow commands"
```

### Task 3: Persist tray UI state and piece zones

**Files:**
- Modify: `src/puzzle/storage.ts`
- Modify: `src/app/routes/PlayPage.tsx`
- Test: `tests/puzzle-storage.test.ts`
- Test: `tests/play-sidebar.test.tsx`

**Step 1: Write the failing tests**

```ts
it('persists tray collapsed state and piece zones', async () => {
  const definition = createPuzzleDefinition(source, DIFFICULTY_PRESETS.medium);
  const session = createPuzzleSession(definition, { seed: 3 });

  session.trayCollapsed = true;
  session.pieces[0].zone = 'board';

  await savePuzzleSession(session);

  const storage = await createStorage();
  const storedSession = await storage.getSession(session.id);

  expect(storedSession?.trayCollapsed).toBe(true);
  expect(storedSession?.pieces[0].zone).toBe('board');
});
```

```tsx
it('lets the player collapse and reopen the tray', async () => {
  render(
    <PlaySidebar
      // existing props...
      trayCollapsed={false}
      onToggleTray={onToggleTray}
      onRearrange={onRearrange}
    />
  );

  await user.click(screen.getByRole('button', { name: /트레이 접기/i }));
  expect(onToggleTray).toHaveBeenCalled();
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/puzzle-storage.test.ts tests/play-sidebar.test.tsx`

Expected: FAIL because the session shape and sidebar API do not support tray state yet.

**Step 3: Write minimal implementation**

```tsx
const [trayCollapsed, setTrayCollapsed] = useState(false);

// when loading:
setSession(storedSession);

// when mutating session:
setSession({
  ...nextSession,
  trayCollapsed
});
```

```tsx
<PlaySidebar
  trayCollapsed={session.trayCollapsed}
  onToggleTray={() => {
    setSession((current) => current ? { ...current, trayCollapsed: !current.trayCollapsed } : current);
  }}
  onRearrange={() => {
    setSession((current) => current ? { ...rearrangeLoosePieces(current, current.definition), elapsedMs } : current);
  }}
/>
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/puzzle-storage.test.ts tests/play-sidebar.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/puzzle-storage.test.ts tests/play-sidebar.test.tsx src/puzzle/storage.ts src/app/routes/PlayPage.tsx
git commit -m "feat: persist tray workspace state"
```

### Task 4: Render the tray workspace and board outlines in Phaser

**Files:**
- Modify: `src/app/ui/PuzzleBoard.tsx`
- Modify: `src/app/routes/PlayPage.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/board-sound.test.ts`
- Create: `tests/puzzle-board.test.tsx`

**Step 1: Write the failing tests**

```tsx
it('passes tray collapse state into the board and exposes a rearrange control', async () => {
  render(<PlayPage />);
  expect(screen.getByRole('button', { name: /자동 재정렬/i })).toBeInTheDocument();
});
```

```ts
it('keeps drag-end sound behavior unchanged when a piece snaps from the tray', () => {
  expect(
    resolveBoardDragEndSounds({
      didSnap: true,
      wasCompletedBefore: false,
      isCompletedNow: false
    })
  ).toEqual(['piece_snap']);
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/puzzle-board.test.tsx tests/board-sound.test.ts`

Expected: FAIL because the new board UI and test file do not exist yet.

**Step 3: Write minimal implementation**

```ts
interface PuzzleBoardProps {
  session: PuzzleSession;
  highlightedPieceId: string | null;
  trayCollapsed: boolean;
  onPlaySound: (soundId: SoundId) => void;
  onSessionChange: (session: PuzzleSession) => void;
}
```

```ts
private renderBoardOutline() {
  this.currentSession.definition.pieces.forEach((piece) => {
    const graphics = this.add.graphics();
    graphics.lineStyle(1.5, 0x245670, 0.14);
    tracePiecePath(
      graphics as unknown as CanvasRenderingContext2D,
      piece,
      this.currentSession.definition.pieceWidth,
      this.currentSession.definition.pieceHeight,
      0
    );
  });
}
```

```ts
private renderTrayChrome() {
  if (this.currentSession.trayCollapsed) {
    return;
  }

  this.add.rectangle(1030, 380, 260, 620, 0xfffcf7, 0.74).setStrokeStyle(2, 0x245670, 0.16);
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/puzzle-board.test.tsx tests/board-sound.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/puzzle-board.test.tsx tests/board-sound.test.ts src/app/ui/PuzzleBoard.tsx src/app/routes/PlayPage.tsx src/app/styles.css
git commit -m "feat: add tray workspace board layout"
```

### Task 5: Full regression verification

**Files:**
- Modify: `tests/home-page.test.tsx` if labels changed
- Modify: `tests/complete-page.test.tsx` if routing props changed
- Verify: `tests/audio-assets.test.ts`
- Verify: `tests/upload-validation.test.ts`

**Step 1: Run focused regression tests**

Run: `pnpm test tests/home-page.test.tsx tests/complete-page.test.tsx tests/audio-assets.test.ts tests/upload-validation.test.ts`

Expected: PASS.

**Step 2: Run the full test suite**

Run: `pnpm test`

Expected: PASS with all test files green.

**Step 3: Run the production build**

Run: `pnpm build`

Expected: PASS. Chunk-size warning is acceptable unless the change introduces a new failure.

**Step 4: Commit**

```bash
git add tests src
git commit -m "test: verify tray workspace integration"
```
