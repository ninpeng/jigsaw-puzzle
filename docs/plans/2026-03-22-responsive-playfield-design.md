# Responsive Playfield Design

**Date:** 2026-03-22

**Supersedes:** `docs/plans/2026-03-22-tray-workspace-design.md`

**Goal:** Replace the fixed `1180x760` playfield with a Phaser-driven responsive layout that uses the available screen space, supports desktop/tablet and mobile tray patterns, and stores piece state in a viewport-independent form.

## Product Direction

- The play screen should use the available viewport instead of pretending every device is a fixed-size canvas.
- The board remains the visual focus.
- Desktop and tablet keep a right-side tray.
- Mobile uses a bottom drawer tray.
- The game should feel the same after resize, reload, or device rotation.

## Architecture

### Screen Ownership

- React continues to own routing, home/completion screens, uploads, and high-level controls.
- Phaser owns the playfield layout for the play screen:
  - board rectangle
  - tray rectangle
  - tray slot coordinates
  - board outline rendering
  - piece rendering, drag, snap, and resize response

### Layout Authority

- `PlayPage` renders a full-size play container and reports its actual pixel size to Phaser.
- Phaser recalculates layout whenever the container size changes.
- Layout is not stored as fixed coordinates in engine constants.
- The engine stores semantic piece placement, and Phaser resolves that into actual pixels for the current device mode.

## Device Modes

### Desktop / Tablet

- Board on the left
- Collapsible tray on the right
- Collapsing the tray gives more width back to the board area

### Mobile

- Board at the top
- Tray as a bottom drawer
- Drawer is collapsed by default
- Opening the drawer reduces available board height and triggers a layout recompute

### Mode Selection

- Phaser decides the mode from the current container aspect ratio and width thresholds.
- Resize and orientation changes can switch modes.
- Piece placement should survive mode switches without losing semantic position.

## Persistent State Model

### Piece Placement

- Fixed pieces do not store free-form coordinates.
- Tray pieces store:
  - `zone: 'tray'`
  - `traySlotIndex`
- Loose board pieces store:
  - `zone: 'board'`
  - `boardPosition`
  - `boardPosition` is relative to the current board rectangle, not the whole screen

### Session UI State

- Store whether the tray is collapsed/open.
- The same session field is interpreted by device mode:
  - desktop/tablet: right tray collapsed or open
  - mobile: drawer collapsed or open

## Rendering Rules

### Board

- Phaser calculates the largest board rectangle that fits the current device mode.
- The board preserves the image aspect ratio.
- The faint image preview remains.
- Piece outlines are drawn on top of the board surface as passive guidance.

### Tray

- Tray slots are computed from tray rectangle dimensions and current piece display size.
- Tray pieces are rendered into slots, not free pixel positions.
- `자동 재정렬` becomes a slot-order operation.
- `가장자리 분리` becomes a slot-order regrouping operation.

### Piece Display Size

- Piece display size can differ from raw puzzle-piece pixel dimensions.
- This is especially important for tray rendering, where the tray may use a smaller piece display scale than the board.
- The board and tray can share semantic piece state while rendering different display sizes if needed.

## Resize Behavior

- On resize:
  - determine device mode
  - recompute board rect
  - recompute tray rect
  - recompute tray slots
  - reproject loose board pieces from relative board positions
  - remap tray pieces by slot index
- Fixed pieces always resolve to their home positions inside the recomputed board rect.

## Migration

- Existing saved sessions currently store absolute pixel positions.
- On load:
  - pieces inside the old board bounds migrate to `zone: 'board'` + relative board position
  - pieces outside the old board bounds migrate to `zone: 'tray'` + inferred slot ordering
- After migration, sessions are re-saved in the new normalized format.

## Error Handling

- If a viewport is too small for the desktop/tablet layout, fall back to mobile mode.
- If tray slot count changes after resize, preserve slot order and reflow pieces into the new slot grid.
- If migration cannot confidently classify a piece, default it into the tray rather than risking overlap on the board.

## Testing Scope

- Layout tests for desktop/tablet/mobile board and tray rectangles
- Engine tests for tray slot order, board-relative storage, and migration from legacy sessions
- UI tests for tray collapse/drawer behavior and responsive control rendering
- Regression tests for snap, completion, hint, audio, upload, and autosave

## Recommendation

Implement this as a true responsive refactor, not a CSS-only patch. The fixed pixel constants are the root of the tray-space failure, so the durable fix is to move playfield layout into Phaser and store piece state independently from screen pixels.
