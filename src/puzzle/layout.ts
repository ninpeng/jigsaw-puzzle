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
      slots: input.trayCollapsed ? [] : buildTraySlots(trayRect, input.pieceCount),
      collapsed: input.trayCollapsed
    }
  };
}

function buildMobileLayout(input: BuildPlayLayoutInput, boardAspect: number): PlayLayout {
  const trayHeight = input.trayCollapsed ? TRAY_COLLAPSED_WIDTH : TRAY_DRAWER_HEIGHT;
  const availableHeight = Math.max(240, input.height - SAFE_MARGIN * 2 - GAP - trayHeight);
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
    y: input.height - SAFE_MARGIN - trayHeight,
    width: input.width - SAFE_MARGIN * 2,
    height: trayHeight
  };

  return {
    mode: 'mobile',
    board: { rect: boardRect },
    tray: {
      rect: trayRect,
      slots: input.trayCollapsed ? [] : buildTraySlots(trayRect, input.pieceCount),
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

function buildTraySlots(trayRect: LayoutRect, pieceCount: number): LayoutRect[] {
  if (pieceCount <= 0) {
    return [];
  }

  let best: { columns: number; rows: number; slotSize: number } | null = null;

  for (let columns = 1; columns <= pieceCount; columns += 1) {
    const rows = Math.max(1, Math.ceil(pieceCount / columns));
    const slotWidth = Math.floor((trayRect.width - GAP * (columns + 1)) / columns);
    const slotHeight = Math.floor((trayRect.height - GAP * (rows + 1)) / rows);
    const slotSize = Math.min(slotWidth, slotHeight);

    if (slotSize <= 0) {
      continue;
    }

    if (!best || slotSize > best.slotSize) {
      best = { columns, rows, slotSize };
    }
  }

  if (!best) {
    return [];
  }

  return buildSlots(trayRect, pieceCount, best.columns, best.rows, best.slotSize);
}

function buildSlots(
  trayRect: LayoutRect,
  pieceCount: number,
  columns: number,
  rows: number,
  slotSize: number
): LayoutRect[] {
  const slots: LayoutRect[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (slots.length >= pieceCount) {
        return slots;
      }

      slots.push({
        x: trayRect.x + GAP + col * (slotSize + GAP),
        y: trayRect.y + GAP + row * (slotSize + GAP),
        width: slotSize,
        height: slotSize
      });
    }
  }

  return slots;
}
