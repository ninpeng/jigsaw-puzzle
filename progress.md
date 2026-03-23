Original prompt: 맥북 같은 해상도에서 퍼즐 영역이 세로가 더 길게 찌그러져서 나와.. UI를 전반적으로 수정해야할 것 같다.

- 2026-03-23: Implementation started for the play UI refactor.
- Goals: replace the fixed play sidebar with a compact HUD, move tray controls into the tray itself, add reference popover flow, and add portrait-upload rotation review before saving uploads.
- Constraints: play remains landscape-only across phone and iPad, preserve existing hint/separate-edge/session-restore behavior, and verify on iPad/MacBook/1080p-style viewports.
- 2026-03-23: Added failing tests for iPad portrait guard, tray-handle controls, reference popover flow, board-first wide layout sizing, and portrait upload review/confirm/cancel flow.
- 2026-03-24: Implemented the compact Play HUD, tray-handle overlay, tray-internal paging controls, reference popover, and portrait upload review dialog.
- 2026-03-24: Added window.render_game_to_text and window.advanceTime hooks for game-state inspection.
- Verification: pnpm test => 14 files / 52 tests passing. pnpm build => success, with the existing PuzzleBoard large-chunk warning still present.
- Browser verification: confirmed 1440x900 play layout with a larger board-first workspace, tools menu + reference popover flow, iPad-style portrait rotation guard (via coarse-pointer emulation), and portrait upload review/confirm flow using a temporary SVG upload.
- 2026-03-24: Fixed tray-to-board drag mapping for edge placements. Root cause was `PuzzleBoard.toBoardPoint()` converting drop positions with board scale even while tray pieces are still rendered at tray scale during drag, which pushed left/top drops outside the board and sent them back to the tray.
- 2026-03-24: Added a regression test for tray-sized edge-piece drops and updated the existing mobile tray drag test to use the correct tray-scale drag coordinates.
- Verification: pnpm test => 14 files / 53 tests passing. pnpm build => success, with the existing PuzzleBoard large-chunk warning still present.
- 2026-03-24: Follow-up user feedback showed the previous fix was incomplete. Updated tray drag interaction so loose tray pieces are promoted to board scale as soon as drag starts, and drag-end coordinate conversion now uses that board-scale drag state instead of the smaller tray scale.
- 2026-03-24: Refined board drag regression tests to assert tray pieces expand to board scale during drag and that edge drops resolve to the expected canonical board coordinates.
