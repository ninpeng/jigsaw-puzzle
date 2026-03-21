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
const MIN_BOARD_WIDTH = 720;
const TRAY_SLOT_GAP = 12;
const TRAY_SLOT_COLUMNS = 2;
const TRAY_SLOT_WIDTH = 240;

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

function buildTraySlotPosition(index: number, definition: PuzzleDefinition): Point {
  const columns = Math.max(TRAY_SLOT_COLUMNS, Math.floor(TRAY_SLOT_WIDTH / (definition.pieceWidth + TRAY_SLOT_GAP)));
  return {
    x: definition.board.x + definition.board.width + 36 + (index % columns) * (definition.pieceWidth + TRAY_SLOT_GAP),
    y: definition.board.y + 24 + Math.floor(index / columns) * (definition.pieceHeight + TRAY_SLOT_GAP)
  };
}

function buildSessionPiece(definitionPiece: PuzzlePieceDefinition, trayIndex: number, definition: PuzzleDefinition): PuzzlePieceState {
  const slot = buildTraySlotPosition(trayIndex, definition);
  return {
    ...definitionPiece,
    x: slot.x,
    y: slot.y,
    fixed: false,
    zone: 'tray'
  };
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

  return {
    id: `session-${definition.id}-${timestamp}`,
    definition,
    pieces: definition.pieces.map((piece, index) => buildSessionPiece(piece, index, definition)),
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

  piece.x = point.x;
  piece.y = point.y;
  nextSession.lastUpdatedAt = nowIso();
  return nextSession;
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
    Math.abs(piece.x - piece.homeX) <= snapDistance &&
    Math.abs(piece.y - piece.homeY) <= snapDistance;

  if (!shouldSnap) {
    return { didSnap: false, session: movedSession };
  }

  piece.x = piece.homeX;
  piece.y = piece.homeY;
  piece.fixed = true;
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

    const arrangedPiece = {
      ...piece,
      x: 28 + (columnIndex % 7) * (definition.pieceWidth + 12),
      y: trayTop + Math.floor(columnIndex / 7) * (definition.pieceHeight + 12)
    };

    columnIndex += 1;
    return arrangedPiece;
  });

  nextSession.assistActions.push({
    type: 'separate_edges',
    timestamp: nowIso()
  });
  nextSession.lastUpdatedAt = nowIso();
  return nextSession;
}
