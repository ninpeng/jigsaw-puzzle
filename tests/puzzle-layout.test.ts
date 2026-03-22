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
    expect(layout.tray.rect.y).toBeGreaterThan(layout.board.rect.y);
  });
});
