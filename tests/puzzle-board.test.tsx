import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayLayout, PuzzleSession } from '../src/puzzle';

const puzzleMocks = vi.hoisted(() => {
  const buildPlayLayout = vi.fn();
  const snapPieceToBoard = vi.fn();

  return {
    buildPlayLayout,
    snapPieceToBoard
  };
});

vi.mock('../src/puzzle', async () => {
  const actual = await vi.importActual<typeof import('../src/puzzle')>('../src/puzzle');

  puzzleMocks.snapPieceToBoard.mockImplementation(actual.snapPieceToBoard);

  return {
    ...actual,
    buildPlayLayout: puzzleMocks.buildPlayLayout,
    snapPieceToBoard: puzzleMocks.snapPieceToBoard
  };
});

const phaserMocks = vi.hoisted(() => {
  const setZoom = vi.fn();
  const resize = vi.fn();
  const destroy = vi.fn();
  const gameInstances: Array<{ config: any }> = [];
  const sceneInstances: any[] = [];
  const loadCalls: Array<{ key: string; url: string }> = [];
  const addCanvasCalls: string[] = [];
  const inputHandlers: Record<string, (...args: any[]) => void> = {};
  const textureKeys = new Set<string>();
  const imageCalls: Array<MockImage> = [];
  const rectangleCalls: Array<MockRectangle> = [];

  class MockImage {
    x: number;
    y: number;
    textureKey: string;
    alpha = 1;
    depth = 0;
    scale = 1;
    displayWidth = 0;
    displayHeight = 0;
    destroyed = false;
    private data = new Map<string, unknown>();
    input = { enabled: true };

    constructor(x: number, y: number, textureKey: string) {
      this.x = x;
      this.y = y;
      this.textureKey = textureKey;
    }

    setData(key: string, value: unknown) {
      this.data.set(key, value);
      return this;
    }

    getData(key: string) {
      return this.data.get(key);
    }

    setDepth(depth: number) {
      this.depth = depth;
      return this;
    }

    setInteractive() {
      this.input.enabled = true;
      return this;
    }

    disableInteractive() {
      this.input.enabled = false;
      return this;
    }

    setScale(scale: number) {
      this.scale = scale;
      return this;
    }

    setDisplaySize(width: number, height: number) {
      this.displayWidth = width;
      this.displayHeight = height;
      return this;
    }

    setAlpha(alpha: number) {
      this.alpha = alpha;
      return this;
    }

    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  class MockRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor: number | null;
    fillAlpha: number | null;
    strokeStyle: { width: number; color: number; alpha: number } | null = null;
    destroyed = false;

    constructor(
      x: number,
      y: number,
      width: number,
      height: number,
      fillColor: number | null,
      fillAlpha: number | null
    ) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.fillColor = fillColor;
      this.fillAlpha = fillAlpha;
    }

    setStrokeStyle(width: number, color: number, alpha = 1) {
      this.strokeStyle = { width, color, alpha };
      return this;
    }

    setFillStyle(fillColor: number, fillAlpha = 1) {
      this.fillColor = fillColor;
      this.fillAlpha = fillAlpha;
      return this;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  class Scene {
    add = {
      image: (x: number, y: number, textureKey: string) => {
        const image = new MockImage(x, y, textureKey);
        imageCalls.push(image);
        return image;
      },
      rectangle: (
        x: number,
        y: number,
        width: number,
        height: number,
        fillColor?: number,
        fillAlpha?: number
      ) => {
        const rectangle = new MockRectangle(x, y, width, height, fillColor ?? null, fillAlpha ?? null);
        rectangleCalls.push(rectangle);
        return rectangle;
      }
    };

    load = {
      image: (key: string, url: string) => {
        loadCalls.push({ key, url });
        textureKeys.add(key);
      }
    };

    textures = {
      exists: (key: string) => textureKeys.has(key),
      get: (key: string) => ({
        getSourceImage: () => ({ key })
      }),
      addCanvas: (key: string) => {
        textureKeys.add(key);
        addCanvasCalls.push(key);
      }
    };

    input = {
      on: (eventName: string, handler: (...args: any[]) => void) => {
        inputHandlers[eventName] = handler;
      },
      setDraggable: vi.fn()
    };

    tweens = {
      add: vi.fn(() => ({ stop: vi.fn() }))
    };

    constructor(_key?: string) {}
  }

  class Game {
    scale = {
      setZoom,
      resize
    };

    destroy = destroy;

    constructor(config: any) {
      gameInstances.push({ config });
      sceneInstances.push(config.scene);
      if (typeof config.scene?.preload === 'function') {
        config.scene.preload();
      }
      if (typeof config.scene?.create === 'function') {
        config.scene.create();
      }
    }
  }

  return {
    setZoom,
    resize,
    destroy,
    gameInstances,
    sceneInstances,
    loadCalls,
    addCanvasCalls,
    inputHandlers,
    textureKeys,
    imageCalls,
    rectangleCalls,
    Game,
    Scene,
    CANVAS: 'CANVAS'
  };
});

vi.mock('phaser', () => {
  return {
    default: {
      Game: phaserMocks.Game,
      Scene: phaserMocks.Scene,
      CANVAS: 'CANVAS'
    },
    Game: phaserMocks.Game,
    Scene: phaserMocks.Scene,
    CANVAS: 'CANVAS'
  };
});

import { PuzzleBoard } from '../src/app/ui/PuzzleBoard';

const definition: PuzzleSession['definition'] = {
  id: 'built-in-aurora:easy',
  sourceId: 'built-in-aurora',
  sourceType: 'built_in' as const,
  sourceTitle: 'Aurora Lake',
  imageDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  thumbnailDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  imageWidth: 1600,
  imageHeight: 900,
  preset: {
    id: 'easy' as const,
    label: 'Easy',
    rows: 2,
    cols: 2,
    snapDistance: 48
  },
  board: { x: 120, y: 96, width: 720, height: 480 },
  pieceWidth: 120,
  pieceHeight: 120,
  pieces: [
    {
      id: 'piece-0',
      row: 0,
      col: 0,
      homeX: 300,
      homeY: 216,
      isEdge: true,
      connectors: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    {
      id: 'piece-1',
      row: 0,
      col: 1,
      homeX: 420,
      homeY: 216,
      isEdge: true,
      connectors: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    {
      id: 'piece-2',
      row: 1,
      col: 0,
      homeX: 300,
      homeY: 336,
      isEdge: true,
      connectors: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    {
      id: 'piece-3',
      row: 1,
      col: 1,
      homeX: 420,
      homeY: 336,
      isEdge: true,
      connectors: { top: 0, right: 0, bottom: 0, left: 0 }
    }
  ]
} as const;

function makeSession(overrides: Partial<PuzzleSession> = {}): PuzzleSession {
  const pieces: PuzzleSession['pieces'] = definition.pieces.map((piece, index) => ({
    ...piece,
    x: 900 + index * 10,
    y: 180 + index * 12,
    fixed: false,
    zone: index === 0 ? ('board' as const) : ('tray' as const),
    traySlotIndex: index === 0 ? null : index - 1,
    boardPosition:
      index === 0
        ? {
            x: 0.25,
            y: 0.25
          }
        : null
  }));

  return {
    id: 'session-board',
    definition,
    pieces,
    startedAt: '2026-03-13T00:00:00.000Z',
    lastUpdatedAt: '2026-03-13T00:00:00.000Z',
    elapsedMs: 0,
    completedAt: null,
    assistActions: [],
    trayCollapsed: false,
    ...overrides
  };
}

function makeSparseTraySession(): PuzzleSession {
  const session = makeSession();

  return {
    ...session,
    pieces: session.pieces.map((piece) =>
      piece.zone === 'tray' && piece.traySlotIndex !== null
        ? {
            ...piece,
            traySlotIndex: piece.traySlotIndex + 11
          }
        : piece
    )
  };
}

function makeLayout(width: number, height: number, traySlots: PlayLayout['tray']['slots']): PlayLayout {
  return {
    mode: width >= 900 ? 'desktop' : 'mobile',
    board: {
      rect: {
        x: 40,
        y: 24,
        width,
        height
      }
    },
    tray: {
      rect: {
        x: 60,
        y: height + 72,
        width: 280,
        height: 180
      },
      slots: traySlots,
      collapsed: false,
      pageSize: traySlots.length,
      pageCount: traySlots.length > 0 ? Math.ceil(3 / traySlots.length) : 0
    }
  };
}

describe('PuzzleBoard', () => {
  beforeEach(() => {
    puzzleMocks.buildPlayLayout.mockReset();
    puzzleMocks.snapPieceToBoard.mockClear();
    phaserMocks.setZoom.mockClear();
    phaserMocks.resize.mockClear();
    phaserMocks.destroy.mockClear();
    phaserMocks.gameInstances.length = 0;
    phaserMocks.sceneInstances.length = 0;
    phaserMocks.loadCalls.length = 0;
    phaserMocks.addCanvasCalls.length = 0;
    phaserMocks.imageCalls.length = 0;
    phaserMocks.rectangleCalls.length = 0;
    phaserMocks.textureKeys.clear();
    for (const key of Object.keys(phaserMocks.inputHandlers)) {
      delete phaserMocks.inputHandlers[key];
    }

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      return {
        save: vi.fn(),
        restore: vi.fn(),
        clip: vi.fn(),
        drawImage: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetY: 0,
        strokeStyle: '',
        lineWidth: 0
      } as unknown as CanvasRenderingContext2D;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses buildPlayLayout for the viewport and positions chrome and pieces from layout rects', async () => {
    const layout = makeLayout(960, 640, [
      { x: 900, y: 120, width: 120, height: 120 },
      { x: 1040, y: 120, width: 120, height: 120 }
    ]);
    puzzleMocks.buildPlayLayout.mockReturnValue(layout);

    render(
      <PuzzleBoard
        session={makeSession()}
        highlightedPieceId={null}
        viewport={{ width: 1120, height: 760 }}
        currentTrayPage={0}
        onPlaySound={vi.fn()}
        onSessionChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(puzzleMocks.buildPlayLayout).toHaveBeenCalledWith({
        width: 1120,
        height: 760,
        trayCollapsed: false,
        pieceCount: 3,
        imageWidth: 1600,
        imageHeight: 900
      });
    });

    const boardImage = phaserMocks.imageCalls.find(
      (call) => call.textureKey === 'board-built-in-aurora'
    );
    const boardPiece = phaserMocks.imageCalls.find(
      (call) => call.getData('pieceId') === 'piece-0'
    );

    expect(boardImage).toMatchObject({
      x: 520,
      y: 344,
      displayWidth: 960,
      displayHeight: 640
    });
    expect(boardPiece).toMatchObject({
      x: 360,
      y: 264
    });
    expect(boardPiece?.scale).toBeCloseTo(1.3333, 3);
  });

  it('recomputes layout when the viewport changes instead of keeping the initial board scale', async () => {
    const desktopLayout = makeLayout(960, 640, [
      { x: 900, y: 120, width: 120, height: 120 }
    ]);
    const mobileLayout = makeLayout(600, 420, [
      { x: 80, y: 540, width: 120, height: 120 }
    ]);

    puzzleMocks.buildPlayLayout.mockImplementation(({ width }) =>
      width >= 900 ? desktopLayout : mobileLayout
    );

    const { rerender } = render(
      <PuzzleBoard
        session={makeSession()}
        highlightedPieceId={null}
        viewport={{ width: 1120, height: 760 }}
        currentTrayPage={0}
        onPlaySound={vi.fn()}
        onSessionChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(phaserMocks.imageCalls.find((call) => call.getData('pieceId') === 'piece-0')?.x).toBe(
        360
      );
    });

    rerender(
      <PuzzleBoard
        session={makeSession()}
        highlightedPieceId={null}
        viewport={{ width: 640, height: 760 }}
        currentTrayPage={0}
        onPlaySound={vi.fn()}
        onSessionChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(puzzleMocks.buildPlayLayout.mock.calls.length).toBeGreaterThan(1);
    });

    const boardPiece = phaserMocks.imageCalls.find((call) => call.getData('pieceId') === 'piece-0');
    expect(boardPiece).toMatchObject({
      x: 240,
      y: 179
    });
    expect(boardPiece?.scale).toBeCloseTo(0.8333, 3);
  });

  it('renders only the selected mobile tray page and converts drag end coordinates back to canonical board space', async () => {
    const mobileLayout = makeLayout(960, 640, [{ x: 76, y: 680, width: 96, height: 96 }]);
    mobileLayout.mode = 'mobile';
    mobileLayout.tray.pageSize = 1;
    mobileLayout.tray.pageCount = 3;
    puzzleMocks.buildPlayLayout.mockReturnValue(mobileLayout);

    const onSessionChange = vi.fn();
    render(
      <PuzzleBoard
        session={makeSparseTraySession()}
        highlightedPieceId={null}
        viewport={{ width: 640, height: 760 }}
        currentTrayPage={1}
        onPlaySound={vi.fn()}
        onSessionChange={onSessionChange}
      />
    );

    await waitFor(() => {
      expect(phaserMocks.imageCalls.some((call) => call.getData('pieceId') === 'piece-2')).toBe(
        true
      );
    });

    const renderedPieceIds = phaserMocks.imageCalls
      .filter((call) => typeof call.getData('pieceId') === 'string')
      .map((call) => call.getData('pieceId') as string);

    expect(renderedPieceIds).toEqual(['piece-0', 'piece-2']);

    const draggedPiece = phaserMocks.imageCalls.find((call) => call.getData('pieceId') === 'piece-2');
    expect(draggedPiece).toBeDefined();

    draggedPiece?.setPosition(360, 264);
    phaserMocks.inputHandlers.dragend?.({}, draggedPiece);

    await waitFor(() => {
      expect(puzzleMocks.snapPieceToBoard).toHaveBeenCalled();
    });

    expect(puzzleMocks.snapPieceToBoard).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      'piece-2',
      {
        x: 300,
        y: 216
      }
    );
    expect(draggedPiece).toMatchObject({
      x: 360,
      y: 264
    });
    const updatedSession = onSessionChange.mock.calls.at(-1)?.[0] as PuzzleSession | undefined;
    expect(updatedSession?.pieces.find((piece: PuzzleSession['pieces'][number]) => piece.id === 'piece-2')).toMatchObject({
      zone: 'board',
      traySlotIndex: null,
      boardPosition: {
        x: 0.25,
        y: 0.25
      }
    });
    expect(onSessionChange).toHaveBeenCalled();
  });
});
