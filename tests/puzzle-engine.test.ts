import {
  DIFFICULTY_PRESETS,
  createPuzzleDefinition,
  createPuzzleSession,
  updatePiecePosition,
  separateEdgePieces,
  snapPieceToBoard
} from '../src/puzzle';
import type { PuzzleSource } from '../src/puzzle';

const builtInSource: PuzzleSource = {
  id: 'built-in-aurora',
  type: 'built_in',
  title: 'Aurora Lake',
  imageDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  thumbnailDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  imageWidth: 1600,
  imageHeight: 900
};

const localSource: PuzzleSource = {
  id: 'upload-sunrise',
  type: 'local_upload',
  title: 'Sunrise',
  imageDataUrl: 'data:image/png;base64,AAAA',
  thumbnailDataUrl: 'data:image/png;base64,AAAA',
  imageWidth: 1600,
  imageHeight: 900
};

describe('puzzle engine', () => {
  it('creates mirrored connectors and edge pieces for any source type', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const uploadDefinition = createPuzzleDefinition(localSource, DIFFICULTY_PRESETS.easy);

    expect(definition.pieces).toHaveLength(24);
    expect(uploadDefinition.pieces).toHaveLength(24);

    const firstPiece = definition.pieces[0];
    const rightNeighbor = definition.pieces[1];
    const belowNeighbor = definition.pieces[DIFFICULTY_PRESETS.easy.cols];

    expect(firstPiece.connectors.top).toBe(0);
    expect(firstPiece.connectors.left).toBe(0);
    expect(firstPiece.connectors.right).toBe(-rightNeighbor.connectors.left);
    expect(firstPiece.connectors.bottom).toBe(-belowNeighbor.connectors.top);
  });

  it('snaps only when a piece is close enough to its home position', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const session = createPuzzleSession(definition, { seed: 12 });
    const target = session.pieces[0];

    const closeResult = snapPieceToBoard(session, definition, target.id, {
      x: target.homeX + 8,
      y: target.homeY - 6
    });

    expect(closeResult.didSnap).toBe(true);
    expect(closeResult.session.pieces[0]).toMatchObject({
      x: target.homeX,
      y: target.homeY,
      fixed: true,
      zone: 'board',
      traySlotIndex: null,
      boardPosition: {
        x: target.homeX - definition.board.x,
        y: target.homeY - definition.board.y
      }
    });

    const farSession = createPuzzleSession(definition, { seed: 12 });
    const farTarget = farSession.pieces[0];
    const farResult = snapPieceToBoard(farSession, definition, farTarget.id, {
      x: farTarget.homeX + 60,
      y: farTarget.homeY
    });

    expect(farResult.didSnap).toBe(false);
    expect(farResult.session.pieces[0].fixed).toBe(false);
  });

  it('creates new sessions with every loose piece placed in the tray', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const session = createPuzzleSession(definition, { seed: 12 });

    expect(session.trayCollapsed).toBe(false);
    expect(
      session.pieces.every(
        (piece, index) =>
          piece.fixed ||
          (piece.zone === 'tray' &&
            piece.traySlotIndex === index &&
            piece.boardPosition === null)
      )
    ).toBe(true);
  });

  it('stores normalized board coordinates when a loose piece moves onto the board', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const session = createPuzzleSession(definition, { seed: 12 });
    const target = session.pieces.find((piece) => !piece.fixed)!;

    const movedSession = updatePiecePosition(session, target.id, {
      x: target.homeX,
      y: target.homeY
    });

    expect(movedSession.pieces.find((piece) => piece.id === target.id)).toMatchObject({
      zone: 'board',
      traySlotIndex: null,
      boardPosition: {
        x: target.homeX - definition.board.x,
        y: target.homeY - definition.board.y
      }
    });

    const snapResult = snapPieceToBoard(session, definition, target.id, {
      x: target.homeX + 8,
      y: target.homeY - 6
    });

    expect(snapResult.session.pieces.find((piece) => piece.id === target.id)).toMatchObject({
      zone: 'board',
      fixed: true,
      traySlotIndex: null,
      boardPosition: {
        x: target.homeX - definition.board.x,
        y: target.homeY - definition.board.y
      }
    });
  });

  it('moves only unfixed edge pieces into the assist tray', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const session = createPuzzleSession(definition, { seed: 7 });
    const fixedEdge = session.pieces.find((piece) => piece.isEdge)!;
    fixedEdge.fixed = true;

    const arranged = separateEdgePieces(session, definition);
    const movedEdge = arranged.pieces.find((piece) => piece.id !== fixedEdge.id && piece.isEdge)!;
    const innerPiece = arranged.pieces.find((piece) => !piece.isEdge)!;
    const originalInnerPiece = session.pieces.find((piece) => piece.id === innerPiece.id)!;

    expect(arranged.assistActions.at(-1)?.type).toBe('separate_edges');
    expect(fixedEdge.x).toBe(session.pieces.find((piece) => piece.id === fixedEdge.id)!.x);
    expect(movedEdge.y).toBeGreaterThanOrEqual(definition.board.y + definition.board.height + 24);
    expect(innerPiece.x).toBe(originalInnerPiece.x);
    expect(innerPiece.y).toBe(originalInnerPiece.y);
  });

  it('keeps every initial piece assigned to the tray zone', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const session = createPuzzleSession(definition, { seed: 22 });

    expect(
      session.pieces.every(
        (piece, index) =>
          piece.zone === 'tray' &&
          !piece.fixed &&
          piece.traySlotIndex === index &&
          piece.boardPosition === null
      )
    ).toBe(true);
  });

  it('keeps every loose piece visible and outside the board origin area', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const session = createPuzzleSession(definition, { seed: 22 });

    expect(
      session.pieces.every(
        (piece) =>
          piece.x > -definition.pieceWidth &&
          piece.x < 1180 &&
          piece.y > -definition.pieceHeight &&
          piece.y < 760 &&
          (piece.x < definition.board.x ||
            piece.x > definition.board.x + definition.board.width - definition.pieceWidth ||
            piece.y < definition.board.y ||
            piece.y > definition.board.y + definition.board.height - definition.pieceHeight)
      )
    ).toBe(true);
  });

  it('does not stack loose pieces onto the same tray slot', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.hard);
    const session = createPuzzleSession(definition, { seed: 22 });
    const slotKeys = new Set(
      session.pieces.filter((piece) => !piece.fixed).map((piece) => `${piece.x},${piece.y}`)
    );

    expect(slotKeys.size).toBe(session.pieces.filter((piece) => !piece.fixed).length);
  });
});
