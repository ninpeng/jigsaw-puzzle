import type {
  ConnectorValue,
  DifficultyPreset,
  PuzzleDefinition,
  PuzzlePieceDefinition,
  PuzzlePieceState,
  PuzzleSession,
  PuzzleSource
} from './types';

interface SessionOptions {
  seed?: number;
}

interface Point {
  x: number;
  y: number;
}

interface SnapResult {
  didSnap: boolean;
  session: PuzzleSession;
}

const BOARD_X = 120;
const BOARD_Y = 96;
const LAYOUT_WIDTH = 1180;
const LAYOUT_HEIGHT = 760;
const MIN_BOARD_WIDTH = 720;
const TRAY_SLOT_GAP = 12;

function buildBoardDimensions(source: PuzzleSource): { width: number; height: number } {
  const aspectRatio = source.imageWidth / source.imageHeight;
  const width = Math.max(MIN_BOARD_WIDTH, Math.min(860, Math.round(560 * aspectRatio)));
  const height = Math.round(width / aspectRatio);

  return { width, height };
}

function pickConnector(row: number, col: number, axis: 'horizontal' | 'vertical'): ConnectorValue {
  const parity = axis === 'horizontal' ? row + col : row * 3 + col;
  return parity % 2 === 0 ? 1 : -1;
}

function createPieceConnectors(
  row: number,
  col: number,
  rows: number,
  cols: number,
  pieces: PuzzlePieceDefinition[]
): PuzzlePieceDefinition['connectors'] {
  const top = row === 0 ? 0 : ((-pieces[(row - 1) * cols + col].connectors.bottom) as ConnectorValue);
  const left = col === 0 ? 0 : ((-pieces[row * cols + (col - 1)].connectors.right) as ConnectorValue);
  const right = col === cols - 1 ? 0 : pickConnector(row, col, 'horizontal');
  const bottom = row === rows - 1 ? 0 : pickConnector(row, col, 'vertical');

  return { top, right, bottom, left };
}

function buildTraySlots(definition: PuzzleDefinition, pieceCount: number): Point[] {
  const slots: Point[] = [];
  const stepX = definition.pieceWidth + TRAY_SLOT_GAP;
  const stepY = definition.pieceHeight + TRAY_SLOT_GAP;
  const startX = 24 - definition.pieceWidth - TRAY_SLOT_GAP;
  const endX = LAYOUT_WIDTH - 1;
  const startY = 24 - definition.pieceHeight - TRAY_SLOT_GAP;
  const endY = LAYOUT_HEIGHT - 1;

  for (let y = startY; y <= endY; y += stepY) {
    for (let x = startX; x <= endX; x += stepX) {
      const insideBoard =
        x >= definition.board.x &&
        x <= definition.board.x + definition.board.width - definition.pieceWidth &&
        y >= definition.board.y &&
        y <= definition.board.y + definition.board.height - definition.pieceHeight;

      if (!insideBoard) {
        slots.push({ x, y });

        if (slots.length >= pieceCount) {
          return slots;
        }
      }
    }
  }

  return [{ x: 24, y: 24 }];
}

function getBoardRelativePosition(definition: PuzzleDefinition, point: Point): Point {
  return {
    x: (point.x - definition.board.x) / definition.board.width,
    y: (point.y - definition.board.y) / definition.board.height
  };
}

function isPointInsideBoard(definition: PuzzleDefinition, point: Point): boolean {
  return (
    point.x >= definition.board.x &&
    point.x <= definition.board.x + definition.board.width - definition.pieceWidth &&
    point.y >= definition.board.y &&
    point.y <= definition.board.y + definition.board.height - definition.pieceHeight
  );
}

function compareLooseTrayPieces(a: PuzzlePieceState, b: PuzzlePieceState): number {
  const aIndex = a.traySlotIndex ?? Number.POSITIVE_INFINITY;
  const bIndex = b.traySlotIndex ?? Number.POSITIVE_INFINITY;

  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }

  return a.id.localeCompare(b.id);
}

function buildSessionPiece(
  definitionPiece: PuzzlePieceDefinition,
  slot: Point,
  traySlotIndex: number
): PuzzlePieceState {
  return {
    ...definitionPiece,
    x: slot.x,
    y: slot.y,
    fixed: false,
    zone: 'tray',
    traySlotIndex,
    boardPosition: null
  };
}

function setTrayPlacement(piece: PuzzlePieceState, slotIndex: number | null, point: Point): PuzzlePieceState {
  return {
    ...piece,
    x: point.x,
    y: point.y,
    zone: 'tray',
    traySlotIndex: slotIndex,
    boardPosition: null
  };
}

function setBoardPlacement(piece: PuzzlePieceState, definition: PuzzleDefinition, point: Point): PuzzlePieceState {
  return {
    ...piece,
    x: point.x,
    y: point.y,
    zone: 'board',
    traySlotIndex: null,
    boardPosition: getBoardRelativePosition(definition, point)
  };
}

function normalizeLooseTrayPieces(session: PuzzleSession): PuzzleSession {
  const trayPieces = session.pieces.filter((piece) => !piece.fixed && piece.zone === 'tray');

  trayPieces.sort(compareLooseTrayPieces).forEach((piece, index) => {
    Object.assign(piece, {
      zone: 'tray',
      traySlotIndex: index,
      boardPosition: null
    });
  });

  session.lastUpdatedAt = nowIso();
  return session;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSession(session: PuzzleSession): PuzzleSession {
  return {
    ...session,
    definition: {
      ...session.definition,
      board: { ...session.definition.board },
      preset: { ...session.definition.preset },
      pieces: session.definition.pieces.map((piece) => ({
        ...piece,
        connectors: { ...piece.connectors }
      }))
    },
    pieces: session.pieces.map((piece) => ({
      ...piece,
      connectors: { ...piece.connectors }
    })),
    assistActions: session.assistActions.map((action) => ({ ...action }))
  };
}

export function createPuzzleDefinition(source: PuzzleSource, preset: DifficultyPreset): PuzzleDefinition {
  const boardSize = buildBoardDimensions(source);
  const pieceWidth = Math.round(boardSize.width / preset.cols);
  const pieceHeight = Math.round(boardSize.height / preset.rows);
  const pieces: PuzzlePieceDefinition[] = [];

  for (let row = 0; row < preset.rows; row += 1) {
    for (let col = 0; col < preset.cols; col += 1) {
      pieces.push({
        id: `${source.id}:${preset.id}:${row}-${col}`,
        row,
        col,
        homeX: BOARD_X + col * pieceWidth,
        homeY: BOARD_Y + row * pieceHeight,
        isEdge: row === 0 || col === 0 || row === preset.rows - 1 || col === preset.cols - 1,
        connectors: createPieceConnectors(row, col, preset.rows, preset.cols, pieces)
      });
    }
  }

  return {
    id: `${source.id}:${preset.id}`,
    sourceId: source.id,
    sourceType: source.type,
    sourceTitle: source.title,
    imageDataUrl: source.imageDataUrl,
    thumbnailDataUrl: source.thumbnailDataUrl,
    imageWidth: source.imageWidth,
    imageHeight: source.imageHeight,
    preset,
    board: {
      x: BOARD_X,
      y: BOARD_Y,
      width: pieceWidth * preset.cols,
      height: pieceHeight * preset.rows
    },
    pieceWidth,
    pieceHeight,
    pieces
  };
}

export function createPuzzleSession(definition: PuzzleDefinition, options: SessionOptions = {}): PuzzleSession {
  const timestamp = nowIso();
  const traySlots = buildTraySlots(definition, definition.pieces.length);

  return {
    id: `session-${definition.id}-${timestamp}`,
    definition,
    pieces: definition.pieces.map((piece, index) =>
      buildSessionPiece(piece, traySlots[index] ?? traySlots[traySlots.length - 1], index)
    ),
    startedAt: timestamp,
    lastUpdatedAt: timestamp,
    elapsedMs: 0,
    completedAt: null,
    assistActions: [],
    trayCollapsed: false
  };
}

export function updatePiecePosition(session: PuzzleSession, pieceId: string, point: Point): PuzzleSession {
  const nextSession = cloneSession(session);
  const piece = nextSession.pieces.find((candidate) => candidate.id === pieceId);

  if (!piece || piece.fixed) {
    return session;
  }

  const isBoardPlacement = isPointInsideBoard(nextSession.definition, point);
  const placement = isBoardPlacement
    ? setBoardPlacement(piece, nextSession.definition, point)
    : setTrayPlacement(piece, piece.traySlotIndex, point);

  Object.assign(piece, placement);
  if (isBoardPlacement) {
    nextSession.lastUpdatedAt = nowIso();
    return nextSession;
  }

  return normalizeLooseTrayPieces(nextSession);
}

export function snapPieceToBoard(
  session: PuzzleSession,
  definition: PuzzleDefinition,
  pieceId: string,
  point: Point
): SnapResult {
  const movedSession = updatePiecePosition(session, pieceId, point);
  const piece = movedSession.pieces.find((candidate) => candidate.id === pieceId);

  if (!piece || piece.fixed) {
    return { didSnap: false, session: movedSession };
  }

  const snapDistance = definition.preset.snapDistance;
  const shouldSnap =
    Math.abs(point.x - piece.homeX) <= snapDistance &&
    Math.abs(point.y - piece.homeY) <= snapDistance;

  if (!shouldSnap) {
    return { didSnap: false, session: movedSession };
  }

  Object.assign(piece, {
    ...setBoardPlacement(piece, definition, { x: piece.homeX, y: piece.homeY }),
    fixed: true
  });
  movedSession.completedAt = movedSession.pieces.every((candidate) => candidate.fixed)
    ? nowIso()
    : null;
  movedSession.lastUpdatedAt = nowIso();

  return { didSnap: true, session: movedSession };
}

export function createHint(session: PuzzleSession): { pieceId: string | null; session: PuzzleSession } {
  const nextSession = cloneSession(session);
  const target = nextSession.pieces.find((piece) => !piece.fixed) ?? null;

  nextSession.assistActions.push({
    type: 'hint',
    timestamp: nowIso(),
    pieceId: target?.id
  });
  nextSession.lastUpdatedAt = nowIso();

  return { pieceId: target?.id ?? null, session: nextSession };
}

export function separateEdgePieces(session: PuzzleSession, definition: PuzzleDefinition): PuzzleSession {
  const nextSession = cloneSession(session);
  const trayTop = definition.board.y + definition.board.height + 36;
  let columnIndex = 0;

  nextSession.pieces = nextSession.pieces.map((piece) => {
    if (!piece.isEdge || piece.fixed) {
      return piece;
    }

    const arrangedPiece = setTrayPlacement(piece, columnIndex, {
      x: 28 + (columnIndex % 7) * (definition.pieceWidth + 12),
      y: trayTop + Math.floor(columnIndex / 7) * (definition.pieceHeight + 12)
    });

    const positionedPiece = {
      ...piece,
      ...arrangedPiece
    };

    columnIndex += 1;
    return positionedPiece;
  });

  nextSession.assistActions.push({
    type: 'separate_edges',
    timestamp: nowIso()
  });
  nextSession.lastUpdatedAt = nowIso();
  return normalizeLooseTrayPieces(nextSession);
}
