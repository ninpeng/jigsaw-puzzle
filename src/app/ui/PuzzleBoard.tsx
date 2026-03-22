import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

import { snapPieceToBoard, type PuzzlePieceState, type PuzzleSession } from '../../puzzle';
import { resolveBoardDragEndSounds } from '../audio/boardSound';
import type { SoundId } from '../audio/soundRegistry';

const BOARD_WIDTH = 1180;
const BOARD_HEIGHT = 760;

interface PuzzleBoardProps {
  session: PuzzleSession;
  highlightedPieceId: string | null;
  viewportSize?: { width: number; height: number };
  onPlaySound: (soundId: SoundId) => void;
  onSessionChange: (session: PuzzleSession) => void;
}

class PuzzleBoardScene extends Phaser.Scene {
  private currentSession: PuzzleSession;
  private onPlaySound: (soundId: SoundId) => void;
  private onSessionChange: (session: PuzzleSession) => void;
  private spriteMap = new Map<string, Phaser.GameObjects.Image>();
  private boardTextureKey: string;
  private dragDepth = 10;
  private highlightTween: Phaser.Tweens.Tween | null = null;

  constructor(
    session: PuzzleSession,
    onSessionChange: (session: PuzzleSession) => void,
    onPlaySound: (soundId: SoundId) => void
  ) {
    super('puzzle-board-scene');
    this.currentSession = session;
    this.onPlaySound = onPlaySound;
    this.onSessionChange = onSessionChange;
    this.boardTextureKey = `board-${session.definition.sourceId}`;
  }

  preload() {
    if (!this.textures.exists(this.boardTextureKey)) {
      this.load.image(this.boardTextureKey, this.currentSession.definition.imageDataUrl);
    }
  }

  create() {
    this.renderBoardChrome();
    this.createPieceSprites();
    this.registerInteractions();
  }

  hydrate(session: PuzzleSession) {
    this.currentSession = session;
    this.syncSprites();
  }

  highlightPiece(pieceId: string | null) {
    this.highlightTween?.stop();

    if (!pieceId) {
      return;
    }

    const sprite = this.spriteMap.get(pieceId);

    if (!sprite) {
      return;
    }

    sprite.setDepth(9999);
    this.highlightTween = this.tweens.add({
      targets: sprite,
      scale: 1.08,
      duration: 180,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        sprite.setScale(1);
      }
    });
  }

  private renderBoardChrome() {
    const { board } = this.currentSession.definition;
    this.add.rectangle(590, 380, 1180, 760, 0xf7edd8, 0.9);
    this.add.image(
      board.x + board.width / 2,
      board.y + board.height / 2,
      this.boardTextureKey
    )
      .setDisplaySize(board.width, board.height)
      .setAlpha(0.14);
    this.add
      .rectangle(
        board.x + board.width / 2,
        board.y + board.height / 2,
        board.width + 20,
        board.height + 20
      )
      .setStrokeStyle(4, 0x245670, 0.32)
      .setFillStyle(0xfffbf2, 0.2);
    this.add
      .rectangle(590, board.y + board.height + 96, 1080, 160, 0xfffcf7, 0.6)
      .setStrokeStyle(2, 0x245670, 0.14);
  }

  private createPieceSprites() {
    this.currentSession.pieces.forEach((piece) => {
      const textureKey = this.buildPieceTexture(piece);
      const sprite = this.add.image(
        piece.x + this.currentSession.definition.pieceWidth / 2,
        piece.y + this.currentSession.definition.pieceHeight / 2,
        textureKey
      );

      sprite.setData('pieceId', piece.id);
      sprite.setDepth(piece.fixed ? 1 : this.dragDepth += 1);
      sprite.setInteractive({ useHandCursor: !piece.fixed });

      if (piece.fixed) {
        sprite.disableInteractive();
      }

      this.input.setDraggable(sprite, !piece.fixed);
      this.spriteMap.set(piece.id, sprite);
    });
  }

  private registerInteractions() {
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const sprite = gameObject as Phaser.GameObjects.Image;
      const piece = this.getPiece(sprite);

      if (!piece || piece.fixed) {
        return;
      }

      this.onPlaySound('piece_pickup');
      sprite.setScale(1.02);
      sprite.setDepth(this.dragDepth += 1);
    });

    this.input.on(
      'drag',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
        const sprite = gameObject as Phaser.GameObjects.Image;
        const piece = this.getPiece(sprite);

        if (!piece || piece.fixed) {
          return;
        }

        sprite.setPosition(dragX, dragY);
      }
    );

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const sprite = gameObject as Phaser.GameObjects.Image;
      const piece = this.getPiece(sprite);

      if (!piece || piece.fixed) {
        return;
      }

      sprite.setScale(1);
      const wasCompletedBefore = Boolean(this.currentSession.completedAt);

      const result = snapPieceToBoard(this.currentSession, this.currentSession.definition, piece.id, {
        x: sprite.x - this.currentSession.definition.pieceWidth / 2,
        y: sprite.y - this.currentSession.definition.pieceHeight / 2
      });

      this.currentSession = result.session;
      this.syncSprites();

      if (result.didSnap) {
        this.tweens.add({
          targets: sprite,
          scale: 1.05,
          duration: 120,
          yoyo: true,
          repeat: 1
        });
      }

      resolveBoardDragEndSounds({
        didSnap: result.didSnap,
        wasCompletedBefore,
        isCompletedNow: Boolean(result.session.completedAt)
      }).forEach((soundId) => {
        this.onPlaySound(soundId);
      });

      this.onSessionChange(this.currentSession);
    });
  }

  private syncSprites() {
    this.currentSession.pieces.forEach((piece) => {
      const sprite = this.spriteMap.get(piece.id);

      if (!sprite) {
        return;
      }

      sprite.setPosition(
        piece.x + this.currentSession.definition.pieceWidth / 2,
        piece.y + this.currentSession.definition.pieceHeight / 2
      );
      sprite.setAlpha(piece.fixed ? 1 : 0.98);

      if (piece.fixed) {
        sprite.disableInteractive();
      } else if (!sprite.input?.enabled) {
        sprite.setInteractive({ useHandCursor: true });
        this.input.setDraggable(sprite, true);
      }
    });
  }

  private getPiece(sprite: Phaser.GameObjects.Image): PuzzlePieceState | undefined {
    const pieceId = sprite.getData('pieceId') as string;
    return this.currentSession.pieces.find((piece) => piece.id === pieceId);
  }

  private buildPieceTexture(piece: PuzzlePieceState): string {
    const textureKey = `piece-${this.currentSession.definition.id}-${piece.row}-${piece.col}`;

    if (this.textures.exists(textureKey)) {
      return textureKey;
    }

    const sourceImage = this.textures.get(this.boardTextureKey).getSourceImage() as CanvasImageSource;
    const overhang = Math.round(
      Math.min(this.currentSession.definition.pieceWidth, this.currentSession.definition.pieceHeight) * 0.28
    );
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return this.boardTextureKey;
    }

    canvas.width = this.currentSession.definition.pieceWidth + overhang * 2;
    canvas.height = this.currentSession.definition.pieceHeight + overhang * 2;

    context.save();
    tracePiecePath(
      context,
      piece,
      this.currentSession.definition.pieceWidth,
      this.currentSession.definition.pieceHeight,
      overhang
    );
    context.clip();
    context.drawImage(
      sourceImage,
      overhang - piece.col * this.currentSession.definition.pieceWidth,
      overhang - piece.row * this.currentSession.definition.pieceHeight,
      this.currentSession.definition.board.width,
      this.currentSession.definition.board.height
    );
    context.restore();

    context.save();
    context.shadowColor = 'rgba(46, 62, 74, 0.28)';
    context.shadowBlur = 14;
    context.shadowOffsetY = 10;
    context.strokeStyle = 'rgba(255, 252, 246, 0.92)';
    context.lineWidth = 2.4;
    tracePiecePath(
      context,
      piece,
      this.currentSession.definition.pieceWidth,
      this.currentSession.definition.pieceHeight,
      overhang
    );
    context.stroke();
    context.restore();

    this.textures.addCanvas(textureKey, canvas);
    return textureKey;
  }
}

function tracePiecePath(
  context: CanvasRenderingContext2D,
  piece: PuzzlePieceState,
  width: number,
  height: number,
  overhang: number
) {
  const knobWidth = width * 0.24;
  const knobDepth = Math.min(width, height) * 0.18;
  const left = overhang;
  const top = overhang;
  const right = left + width;
  const bottom = top + height;

  context.beginPath();
  context.moveTo(left, top);

  drawHorizontalEdge(context, left, top, width, piece.connectors.top, -knobDepth, knobWidth);
  drawVerticalEdge(context, right, top, height, piece.connectors.right, knobDepth, knobWidth);
  drawHorizontalEdge(context, right, bottom, -width, piece.connectors.bottom, knobDepth, knobWidth);
  drawVerticalEdge(context, left, bottom, -height, piece.connectors.left, -knobDepth, knobWidth);

  context.closePath();
}

function drawHorizontalEdge(
  context: CanvasRenderingContext2D,
  startX: number,
  y: number,
  width: number,
  connector: number,
  depth: number,
  knobWidth: number
) {
  const direction = Math.sign(width) || 1;
  const absoluteWidth = Math.abs(width);
  const notchCenter = startX + direction * absoluteWidth * 0.5;
  const firstBreak = startX + direction * absoluteWidth * 0.26;
  const secondBreak = startX + direction * absoluteWidth * 0.74;

  context.lineTo(firstBreak, y);

  if (connector !== 0) {
    const arcDepth = depth * connector;
    context.bezierCurveTo(
      firstBreak + direction * knobWidth * 0.2,
      y,
      notchCenter - direction * knobWidth,
      y + arcDepth,
      notchCenter,
      y + arcDepth
    );
    context.bezierCurveTo(
      notchCenter + direction * knobWidth,
      y + arcDepth,
      secondBreak - direction * knobWidth * 0.2,
      y,
      secondBreak,
      y
    );
  }

  context.lineTo(startX + width, y);
}

function drawVerticalEdge(
  context: CanvasRenderingContext2D,
  x: number,
  startY: number,
  height: number,
  connector: number,
  depth: number,
  knobWidth: number
) {
  const direction = Math.sign(height) || 1;
  const absoluteHeight = Math.abs(height);
  const notchCenter = startY + direction * absoluteHeight * 0.5;
  const firstBreak = startY + direction * absoluteHeight * 0.26;
  const secondBreak = startY + direction * absoluteHeight * 0.74;

  context.lineTo(x, firstBreak);

  if (connector !== 0) {
    const arcDepth = depth * connector;
    context.bezierCurveTo(
      x,
      firstBreak + direction * knobWidth * 0.2,
      x + arcDepth,
      notchCenter - direction * knobWidth,
      x + arcDepth,
      notchCenter
    );
    context.bezierCurveTo(
      x + arcDepth,
      notchCenter + direction * knobWidth,
      x,
      secondBreak - direction * knobWidth * 0.2,
      x,
      secondBreak
    );
  }

  context.lineTo(x, startY + height);
}

export function PuzzleBoard({
  session,
  highlightedPieceId,
  viewportSize,
  onPlaySound,
  onSessionChange
}: PuzzleBoardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PuzzleBoardScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return undefined;
    }

    const scene = new PuzzleBoardScene(session, onSessionChange, onPlaySound);
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      parent: hostRef.current,
      transparent: true,
      backgroundColor: '#f7edd8',
      scene
    });

    sceneRef.current = scene;
    gameRef.current = game;

    return () => {
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.hydrate(session);
  }, [session]);

  useEffect(() => {
    sceneRef.current?.highlightPiece(highlightedPieceId);
  }, [highlightedPieceId]);

  useEffect(() => {
    const game = gameRef.current;

    if (!game || !viewportSize?.width || !viewportSize?.height) {
      return;
    }

    const scale = Math.min(viewportSize.width / BOARD_WIDTH, viewportSize.height / BOARD_HEIGHT);
    game.scale.setZoom(scale > 0 ? scale : 1);
  }, [viewportSize]);

  return <div ref={hostRef} className="board-frame" />;
}
