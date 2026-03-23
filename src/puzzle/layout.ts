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
    handleRect: LayoutRect;
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

const SAFE_MARGIN = 14;
const GAP = 14;
const DESKTOP_MIN_WIDTH = 1024;
const TABLET_MIN_WIDTH = 640;
const TRAY_HANDLE_WIDTH = 28;
const DESKTOP_TRAY_MIN_WIDTH = 188;
const DESKTOP_TRAY_MAX_WIDTH = 248;
const TABLET_TRAY_MIN_WIDTH = 168;
const TABLET_TRAY_MAX_WIDTH = 220;
const TRAY_COLLAPSED_WIDTH = TRAY_HANDLE_WIDTH;
const MOBILE_TRAY_COLLAPSED_HEIGHT = 64;
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
  const trayOpenWidth = resolveWideTrayWidth(input.width, mode);
  const trayWidth = input.trayCollapsed ? TRAY_COLLAPSED_WIDTH : trayOpenWidth;
  const availableWidth = Math.max(320, input.width - SAFE_MARGIN * 2 - GAP - trayWidth);
  const availableHeight = Math.max(320, input.height - SAFE_MARGIN * 2);
  const boardSize = fitRect(availableWidth, availableHeight, boardAspect);
  const groupWidth = boardSize.width + GAP + trayWidth;
  const groupOffsetX = Math.max(0, Math.floor((input.width - SAFE_MARGIN * 2 - groupWidth) / 2));
  const boardX = SAFE_MARGIN + groupOffsetX;

  const boardRect = {
    x: boardX,
    y: SAFE_MARGIN + Math.max(0, Math.floor((availableHeight - boardSize.height) / 2)),
    width: boardSize.width,
    height: boardSize.height
  };

  const trayRect = {
    x: boardRect.x + boardRect.width + GAP,
    y: SAFE_MARGIN,
    width: trayWidth,
    height: availableHeight
  };
  const handleRect = {
    x: trayRect.x,
    y: trayRect.y,
    width: Math.min(TRAY_HANDLE_WIDTH, trayRect.width),
    height: trayRect.height
  };

  return {
    mode,
    board: { rect: boardRect },
    tray: {
      rect: trayRect,
      handleRect,
      ...buildWideTrayLayout(trayRect, handleRect, input.pieceCount, input.trayCollapsed),
      collapsed: input.trayCollapsed
    }
  };
}

function buildMobileLayout(input: BuildPlayLayoutInput, boardAspect: number): PlayLayout {
  const trayWidth = input.width - SAFE_MARGIN * 2;
  const resolvedTrayHeight = input.trayCollapsed
    ? MOBILE_TRAY_COLLAPSED_HEIGHT
    : Math.min(TRAY_DRAWER_HEIGHT, Math.max(TRAY_COLLAPSED_WIDTH, input.height - SAFE_MARGIN * 2));
  const canUseDockedDrawer =
    input.trayCollapsed ||
    input.height - SAFE_MARGIN * 2 - GAP - resolvedTrayHeight >= MIN_MOBILE_BOARD_HEIGHT;

  if (canUseDockedDrawer) {
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
    const handleRect = {
      x: trayRect.x,
      y: trayRect.y,
      width: trayRect.width,
      height: Math.min(TRAY_COLLAPSED_WIDTH, trayRect.height)
    };

    return {
      mode: 'mobile',
      board: { rect: boardRect },
      tray: {
        rect: trayRect,
        handleRect,
        ...buildPagedTrayLayout(
          trayRect,
          input.pieceCount,
          MOBILE_TRAY_COLUMNS,
          MOBILE_TRAY_ROWS,
          input.trayCollapsed
        ),
        collapsed: input.trayCollapsed
      }
    };
  }

  const trayRect = {
    x: SAFE_MARGIN,
    y: input.height - SAFE_MARGIN - resolvedTrayHeight,
    width: trayWidth,
    height: resolvedTrayHeight
  };
  const handleRect = {
    x: trayRect.x,
    y: trayRect.y,
    width: trayRect.width,
    height: Math.min(TRAY_COLLAPSED_WIDTH, trayRect.height)
  };
  const availableWidth = Math.max(280, input.width - SAFE_MARGIN * 2);
  const availableHeight = Math.max(MIN_MOBILE_BOARD_HEIGHT, input.height - SAFE_MARGIN * 2);
  const boardSize = fitBoardRect(availableWidth, availableHeight, boardAspect, MIN_MOBILE_BOARD_HEIGHT);
  const boardRect = {
    x: Math.max(SAFE_MARGIN, Math.floor((input.width - boardSize.width) / 2)),
    y: SAFE_MARGIN,
    width: boardSize.width,
    height: boardSize.height
  };

  return {
    mode: 'mobile',
    board: { rect: boardRect },
    tray: {
      rect: trayRect,
      handleRect,
      ...buildPagedTrayLayout(
        trayRect,
        input.pieceCount,
        MOBILE_TRAY_COLUMNS,
        MOBILE_TRAY_ROWS,
        input.trayCollapsed
      ),
      collapsed: input.trayCollapsed
    }
  };
}

function resolveWideTrayWidth(
  width: number,
  mode: Exclude<PlayLayout['mode'], 'mobile'>
): number {
  const ratioWidth = Math.round(width * 0.17);

  if (mode === 'desktop') {
    return clamp(ratioWidth, DESKTOP_TRAY_MIN_WIDTH, DESKTOP_TRAY_MAX_WIDTH);
  }

  return clamp(ratioWidth, TABLET_TRAY_MIN_WIDTH, TABLET_TRAY_MAX_WIDTH);
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

function fitBoardRect(
  maxWidth: number,
  maxHeight: number,
  aspect: number,
  minimumHeight: number
): { width: number; height: number } {
  const minimumWidth = Math.round(minimumHeight * aspect);

  if (minimumHeight <= maxHeight && minimumWidth <= maxWidth) {
    return {
      width: minimumWidth,
      height: minimumHeight
    };
  }

  return fitRect(maxWidth, maxHeight, aspect);
}

function buildWideTrayLayout(
  trayRect: LayoutRect,
  handleRect: LayoutRect,
  pieceCount: number,
  collapsed: boolean
): {
  slots: LayoutRect[];
  pageSize: number;
  pageCount: number;
} {
  if (collapsed || pieceCount <= 0) {
    return { slots: [], pageSize: 0, pageCount: 0 };
  }

  const slotsRect = {
    x: handleRect.x + handleRect.width + 10,
    y: trayRect.y + 10,
    width: Math.max(1, trayRect.width - handleRect.width - 20),
    height: Math.max(1, trayRect.height - 20)
  };
  const slots = buildSinglePageWideTraySlots(slotsRect, pieceCount);

  if (slots.length === 0) {
    return { slots: [], pageSize: 0, pageCount: 0 };
  }

  return {
    slots,
    pageSize: slots.length,
    pageCount: 1
  };
}

function buildPagedTrayLayout(
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

  const slots = buildBoundedTraySlots(trayRect, columns, rows);

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildBoundedTraySlots(trayRect: LayoutRect, columns: number, rows: number): LayoutRect[] {
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

  return slots;
}

function buildSinglePageWideTraySlots(trayRect: LayoutRect, pieceCount: number): LayoutRect[] {
  let bestSlots: LayoutRect[] = [];
  let bestSlotSize = 0;

  for (let columns = 1; columns <= pieceCount; columns += 1) {
    const rows = Math.ceil(pieceCount / columns);
    const slots = buildFixedGridSlots(trayRect, columns, rows, pieceCount);

    if (slots.length !== pieceCount) {
      continue;
    }

    const slotSize = slots[0]?.width ?? 0;

    if (slotSize > bestSlotSize) {
      bestSlots = slots;
      bestSlotSize = slotSize;
    }
  }

  return bestSlots;
}

function buildFixedGridSlots(
  trayRect: LayoutRect,
  columns: number,
  rows: number,
  pieceCount: number
): LayoutRect[] {
  const innerWidth = trayRect.width - GAP * (columns + 1);
  const innerHeight = trayRect.height - GAP * (rows + 1);
  const slotSize = Math.floor(Math.min(innerWidth / columns, innerHeight / rows));

  if (slotSize <= 0) {
    return [];
  }

  const slots: LayoutRect[] = [];

  for (let row = 0; row < rows && slots.length < pieceCount; row += 1) {
    for (let col = 0; col < columns && slots.length < pieceCount; col += 1) {
      const x = trayRect.x + GAP + col * (slotSize + GAP);
      const y = trayRect.y + GAP + row * (slotSize + GAP);
      const slot: LayoutRect = { x, y, width: slotSize, height: slotSize };

      if (slot.x + slot.width > trayRect.x + trayRect.width || slot.y + slot.height > trayRect.y + trayRect.height) {
        continue;
      }

      slots.push(slot);
    }
  }

  return slots;
}
