# Tray Workspace Design

**Date:** 2026-03-22

**Goal:** Improve puzzle play feel by moving loose pieces into a dedicated right-side tray, keeping snap guidance subtle, and showing the piece outline on the board at all times.

## Product Direction

- Keep the game calm and tactile rather than adding strong visual assistance.
- Treat loose-piece management as the main usability upgrade.
- Preserve the current casual single-player flow: no rotation, no aggressive hinting, no extra mode complexity.

## Approved Interaction Model

### Layout

- The play screen remains a two-panel layout.
- The puzzle board stays on the left.
- A collapsible tray lives on the right and is open by default on tablet landscape.
- The tray can be collapsed to reclaim space, then reopened without losing piece state.

### Piece Flow

- New sessions place every unfixed piece in the tray instead of scattering them around the board.
- Players drag pieces out of the tray and onto the board.
- Unsnapped pieces may remain on the board temporarily.
- A new `자동 재정렬` action returns all loose pieces to tray slots and reflows them into a clean grid.
- `가장자리 분리` remains available, but now reorders the single tray so edge pieces are packed first and inner pieces follow.

### Snap Feel

- Snap guidance stays subtle.
- Pieces still only lock when dropped close to their home position.
- There is no ghost preview, strong target highlight, or magnet animation beyond the existing soft snap feedback.

### Board Guidance

- The board always shows the full puzzle image very faintly, as today.
- On top of that, the board also shows the outline of each jigsaw piece shape.
- The outline acts as the primary visual guide instead of strong hint overlays.

## Technical Design

### State Model

- Extend each session piece with a persistent zone marker: `tray` or `board`.
- Persist tray UI state with the session via `trayCollapsed`.
- Keep fixed pieces on the board and exempt from tray commands.
- Use one engine pipeline for built-in and uploaded sources; tray logic is session/layout behavior, not source-specific behavior.

### Engine Responsibilities

- Compute tray slot positions from the existing board layout and current piece size.
- Create sessions with loose pieces already assigned to tray slots.
- Update piece zone as pieces move between tray and board.
- Expose a command that returns all loose pieces to ordered tray slots.
- Rework edge separation to reuse the same tray-slotting helper.

### Phaser Responsibilities

- Render the tray as part of the scene, not as a separate React list.
- Render board outlines once from the puzzle definition and keep them behind the movable pieces.
- Preserve the existing drag and snap flow while updating piece placement based on zone.
- When the tray is collapsed, keep the underlying session state unchanged and only change visible layout constraints.

### React Responsibilities

- Own high-level controls: hint, separate edges, rearrange, tray collapse, home, sound toggle.
- Pass tray UI state and callbacks into the board scene.
- Continue autosaving the session so tray state and piece zones restore on refresh.

## Error Handling

- If tray state fails to save, preserve current in-memory play and surface the existing autosave error path.
- If the viewport changes, recompute tray slot positions for loose pieces without disturbing fixed pieces.
- Uploaded puzzles use the same tray behavior with no special-case UI.

## Testing Scope

- Engine tests for tray-first session creation, rearrange behavior, and edge-first tray ordering.
- Storage tests for persisted piece zones and `trayCollapsed`.
- Board/UI tests for tray toggle wiring, rearrange actions, and board outline rendering hooks.
- Regression checks for hint, completion, and existing sound events.

## Recommendation

Implement the tray workspace and board outline as one feature slice. The two changes reinforce each other: the tray reduces clutter, and the outline gives passive guidance without making the game feel over-assisted.
