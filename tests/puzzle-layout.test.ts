import { buildPlayLayout } from '../src/puzzle';

describe('puzzle layout', () => {
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
    expect(layout.tray.pageSize).toBeGreaterThan(0);
    expect(layout.tray.pageCount).toBe(1);
  });

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
    expect(layout.tray.rect.height).toBe(64);
    expect(layout.tray.rect.y).toBeGreaterThan(layout.board.rect.y);
    expect(layout.tray.slots).toEqual([]);
    expect(layout.tray.pageSize).toBe(0);
    expect(layout.tray.pageCount).toBe(0);
  });

  it('returns no tray slots when the mobile tray is collapsed', () => {
    const layout = buildPlayLayout({
      width: 390,
      height: 844,
      trayCollapsed: true,
      pieceCount: 80,
      imageWidth: 1600,
      imageHeight: 900
    });

    expect(layout.mode).toBe('mobile');
    expect(layout.tray.slots).toEqual([]);
    expect(layout.tray.pageSize).toBe(0);
    expect(layout.tray.pageCount).toBe(0);
  });

  it('keeps desktop tray slots inside the tray rectangle', () => {
    const layout = buildPlayLayout({
      width: 1366,
      height: 900,
      trayCollapsed: false,
      pieceCount: 48,
      imageWidth: 1600,
      imageHeight: 900
    });

    expect(
      layout.tray.slots.every(
        (slot) =>
          slot.x >= layout.tray.rect.x &&
          slot.y >= layout.tray.rect.y &&
          slot.x + slot.width <= layout.tray.rect.x + layout.tray.rect.width &&
          slot.y + slot.height <= layout.tray.rect.y + layout.tray.rect.height
      )
    ).toBe(true);
  });

  it('keeps dense mobile tray slots inside the drawer rectangle and uses paging instead of shrinking the board', () => {
    const layout = buildPlayLayout({
      width: 390,
      height: 844,
      trayCollapsed: false,
      pieceCount: 80,
      imageWidth: 1600,
      imageHeight: 900
    });

    expect(layout.board.rect.height).toBeGreaterThanOrEqual(180);
    expect(layout.tray.pageCount).toBeGreaterThan(1);
    expect(layout.tray.pageSize).toBeGreaterThan(0);
    expect(
      layout.tray.slots.every(
        (slot) =>
          slot.x >= layout.tray.rect.x &&
          slot.y >= layout.tray.rect.y &&
          slot.x + slot.width <= layout.tray.rect.x + layout.tray.rect.width &&
          slot.y + slot.height <= layout.tray.rect.y + layout.tray.rect.height
      )
    ).toBe(true);
    expect(layout.tray.slots.length).toBe(layout.tray.pageSize);
  });

  it('uses an overlay drawer fallback on short mobile viewports to preserve the minimum board height', () => {
    const layout = buildPlayLayout({
      width: 390,
      height: 260,
      trayCollapsed: false,
      pieceCount: 24,
      imageWidth: 1600,
      imageHeight: 900
    });

    expect(layout.mode).toBe('mobile');
    expect(layout.board.rect.height).toBeGreaterThanOrEqual(180);
    expect(layout.tray.rect.y).toBeGreaterThanOrEqual(0);
    expect(layout.tray.rect.y + layout.tray.rect.height).toBeLessThanOrEqual(260);
    expect(layout.tray.rect.y).toBeLessThan(layout.board.rect.y + layout.board.rect.height);
  });

  it('keeps a dense wide tray single-page while fitting all slots inside the tray rectangle', () => {
    const layout = buildPlayLayout({
      width: 1366,
      height: 900,
      trayCollapsed: false,
      pieceCount: 80,
      imageWidth: 1600,
      imageHeight: 900
    });

    expect(layout.mode).toBe('desktop');
    expect(layout.tray.pageCount).toBe(1);
    expect(layout.tray.pageSize).toBeGreaterThan(0);
    expect(layout.tray.slots.length).toBe(layout.tray.pageSize);
    expect(
      layout.tray.slots.every(
        (slot) =>
          slot.x >= layout.tray.rect.x &&
          slot.y >= layout.tray.rect.y &&
          slot.x + slot.width <= layout.tray.rect.x + layout.tray.rect.width &&
          slot.y + slot.height <= layout.tray.rect.y + layout.tray.rect.height
      )
    ).toBe(true);
  });
});
