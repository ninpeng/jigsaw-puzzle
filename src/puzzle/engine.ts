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

const LAYOUT_WIDTH = 1180;
const LAYOUT_HEIGHT = 760;
const BOARD_X = 120;
const BOARD_Y = 96;
const MIN_BOARD_WIDTH = 720;

function createRng(seed = 1): () => number {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

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

function buildSessionPiece(definitionPiece: PuzzlePieceDefinition, rng: () => number, definition: PuzzleDefinition): PuzzlePieceState {
  const safeInset = 18;
  const minX = 24;
  const maxX = LAYOUT_WIDTH - definition.pieceWidth - 24;
  const minY = 24;
  const maxY = LAYOUT_HEIGHT - definition.pieceHeight - 24;
  const boardSafeLeft = definition.board.x + safeInset;
  const boardSafeRight = definition.board.x + definition.board.width - definition.pieceWidth - safeInset;
  const boardSafeTop = definition.board.y + safeInset;
  const boardSafeBottom =
    definition.board.y + definition.board.height - definition.pieceHeight - safeInset;
  let x = minX;
  let y = minY;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    x = minX + Math.round(rng() * (maxX - minX));
    y = minY + Math.round(rng() * (maxY - minY));

    const insideBoardSafeZone =
      x >= boardSafeLeft &&
      x <= boardSafeRight &&
      y >= boardSafeTop &&
      y <= boardSafeBottom;

    if (!insideBoardSafeZone) {
      break;
    }
  }

  return {
    ...definitionPiece,
    x,
    y,
    fixed: false
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
  const rng = createRng(options.seed ?? definition.id.length);
  const timestamp = nowIso();

  return {
    id: `session-${definition.id}-${timestamp}`,
    definition,
    pieces: definition.pieces.map((piece) => buildSessionPiece(piece, rng, definition)),
    startedAt: timestamp,
    lastUpdatedAt: timestamp,
    elapsedMs: 0,
    completedAt: null,
    assistActions: []
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
