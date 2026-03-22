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
  tray: {
    rect: LayoutRect;
    slots: LayoutRect[];
    collapsed: boolean;
    pageSize: number;
    pageCount: number;
  };
}

export interface BuildPlayLayoutInput extends PlayViewport {
  trayCollapsed: boolean;
  pieceCount: number;
  imageWidth: number;
  imageHeight: number;
}

const SAFE_MARGIN = 24;
const GAP = 16;
const DESKTOP_MIN_WIDTH = 1024;
const TABLET_MIN_WIDTH = 640;
const TRAY_OPEN_WIDTH_RATIO = 0.26;
const TRAY_COLLAPSED_WIDTH = 64;
const TRAY_DRAWER_HEIGHT = 188;
const MIN_MOBILE_BOARD_HEIGHT = 180;
const WIDE_TRAY_COLUMNS = 4;
const WIDE_TRAY_ROWS = 4;
const MOBILE_TRAY_COLUMNS = 3;
const MOBILE_TRAY_ROWS = 4;

export function buildPlayLayout(input: BuildPlayLayoutInput): PlayLayout {
  const mode = resolveMode(input.width, input.height);
  const boardAspect = input.imageWidth / input.imageHeight;

  if (mode === 'mobile') {
    return buildMobileLayout(input, boardAspect);
  }

  return buildWideLayout(input, boardAspect, mode);
}

function resolveMode(width: number, height: number): PlayLayout['mode'] {
  if (width >= DESKTOP_MIN_WIDTH && width >= height * 1.08) {
    return 'desktop';
  }

  if (width >= TABLET_MIN_WIDTH) {
    return 'tablet';
  }

  return 'mobile';
}

function buildWideLayout(
  input: BuildPlayLayoutInput,
  boardAspect: number,
  mode: Exclude<PlayLayout['mode'], 'mobile'>
): PlayLayout {
  const trayWidth = input.trayCollapsed
    ? TRAY_COLLAPSED_WIDTH
    : Math.max(220, Math.round(input.width * TRAY_OPEN_WIDTH_RATIO));
  const availableWidth = Math.max(320, input.width - SAFE_MARGIN * 2 - GAP - trayWidth);
  const availableHeight = Math.max(320, input.height - SAFE_MARGIN * 2);
  const boardSize = fitRect(availableWidth, availableHeight, boardAspect);

  const boardRect = {
    x: SAFE_MARGIN,
    y: SAFE_MARGIN + Math.max(0, Math.floor((availableHeight - boardSize.height) / 2)),
    width: boardSize.width,
    height: boardSize.height
  };

  const trayRect = {
    x: boardRect.x + boardRect.width + GAP,
    y: SAFE_MARGIN,
    width: input.width - (boardRect.x + boardRect.width + GAP) - SAFE_MARGIN,
    height: availableHeight
  };

  return {
    mode,
    board: { rect: boardRect },
    tray: {
      rect: trayRect,
      ...buildTrayPage(trayRect, input.pieceCount, WIDE_TRAY_COLUMNS, WIDE_TRAY_ROWS, input.trayCollapsed),
      collapsed: input.trayCollapsed
    }
  };
}

function buildMobileLayout(input: BuildPlayLayoutInput, boardAspect: number): PlayLayout {
  const trayWidth = input.width - SAFE_MARGIN * 2;
  const maxOpenTrayHeight = Math.max(
    TRAY_COLLAPSED_WIDTH,
    input.height - SAFE_MARGIN * 2 - GAP - MIN_MOBILE_BOARD_HEIGHT
  );
  const resolvedTrayHeight = input.trayCollapsed
    ? TRAY_COLLAPSED_WIDTH
    : Math.min(TRAY_DRAWER_HEIGHT, maxOpenTrayHeight);
  const availableHeight = Math.max(1, input.height - SAFE_MARGIN * 2 - GAP - resolvedTrayHeight);
  const availableWidth = Math.max(280, input.width - SAFE_MARGIN * 2);
  const boardSize = fitRect(availableWidth, availableHeight, boardAspect);

  const boardRect = {
    x: Math.max(SAFE_MARGIN, Math.floor((input.width - boardSize.width) / 2)),
    y: SAFE_MARGIN,
    width: boardSize.width,
    height: boardSize.height
  };

  const trayRect = {
    x: SAFE_MARGIN,
    y: input.height - SAFE_MARGIN - resolvedTrayHeight,
    width: trayWidth,
    height: resolvedTrayHeight
  };

  return {
    mode: 'mobile',
    board: { rect: boardRect },
    tray: {
      rect: trayRect,
      ...buildTrayPage(trayRect, input.pieceCount, MOBILE_TRAY_COLUMNS, MOBILE_TRAY_ROWS, input.trayCollapsed),
      collapsed: input.trayCollapsed
    }
  };
}

function fitRect(maxWidth: number, maxHeight: number, aspect: number): { width: number; height: number } {
  let width = maxWidth;
  let height = Math.round(width / aspect);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspect);
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}

function buildTrayPage(
  trayRect: LayoutRect,
  pieceCount: number,
  columns: number,
  rows: number,
  collapsed: boolean
): {
  slots: LayoutRect[];
  pageSize: number;
  pageCount: number;
} {
  if (collapsed || pieceCount <= 0) {
    return { slots: [], pageSize: 0, pageCount: 0 };
  }

  const innerWidth = trayRect.width - GAP * (columns + 1);
  const innerHeight = trayRect.height - GAP * (rows + 1);
  const slotSize = Math.max(1, Math.floor(Math.min(innerWidth / columns, innerHeight / rows)));
  const slots: LayoutRect[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = trayRect.x + GAP + col * (slotSize + GAP);
      const y = trayRect.y + GAP + row * (slotSize + GAP);
      const slot: LayoutRect = { x, y, width: slotSize, height: slotSize };

      if (slot.x + slot.width > trayRect.x + trayRect.width || slot.y + slot.height > trayRect.y + trayRect.height) {
        continue;
      }

      slots.push(slot);
    }
  }

  const pageSize = slots.length;

  if (pageSize === 0) {
    return { slots: [], pageSize: 0, pageCount: 0 };
  }

  return {
    slots: slots.slice(0, Math.min(pieceCount, pageSize)),
    pageSize,
    pageCount: Math.ceil(pieceCount / pageSize)
  };
}
