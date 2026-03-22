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

  it('keeps mobile tray slots inside the drawer rectangle', () => {
    const layout = buildPlayLayout({
      width: 390,
      height: 844,
      trayCollapsed: false,
      pieceCount: 24,
      imageWidth: 1600,
      imageHeight: 900
    });

    expect(layout.tray.rect.height).toBe(188);
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
