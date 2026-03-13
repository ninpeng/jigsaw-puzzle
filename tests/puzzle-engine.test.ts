import {
  DIFFICULTY_PRESETS,
  createPuzzleDefinition,
  createPuzzleSession,
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
      fixed: true
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

  it('keeps every initial piece inside the visible play area', () => {
    const definition = createPuzzleDefinition(builtInSource, DIFFICULTY_PRESETS.easy);
    const session = createPuzzleSession(definition, { seed: 22 });

    expect(
      session.pieces.every(
        (piece) =>
          piece.x >= 24 &&
          piece.x <= 1180 - definition.pieceWidth - 24 &&
          piece.y >= 24 &&
          piece.y <= 760 - definition.pieceHeight - 24
      )
    ).toBe(true);
  });
});
