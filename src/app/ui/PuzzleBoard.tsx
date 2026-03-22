import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

import {
  buildPlayLayout,
  snapPieceToBoard,
  type PlayLayout,
  type PlayViewport,
  type PuzzlePieceState,
  type PuzzleSession
} from '../../puzzle';
import { resolveBoardDragEndSounds } from '../audio/boardSound';
import type { SoundId } from '../audio/soundRegistry';

const FALLBACK_VIEWPORT_WIDTH = 1180;
const FALLBACK_VIEWPORT_HEIGHT = 760;
const BOARD_OUTLINE_PADDING = 20;

interface PuzzleBoardProps {
  session: PuzzleSession;
  highlightedPieceId: string | null;
  viewport?: PlayViewport;
  currentTrayPage: number;
  onPlaySound: (soundId: SoundId) => void;
  onSessionChange: (session: PuzzleSession) => void;
}

interface PiecePlacement {
  centerX: number;
  centerY: number;
  scale: number;
}

class PuzzleBoardScene extends Phaser.Scene {
  private currentSession: PuzzleSession;
  private currentViewport: PlayViewport | null;
  private onPlaySound: (soundId: SoundId) => void;
  private onSessionChange: (session: PuzzleSession) => void;
  private spriteMap = new Map<string, Phaser.GameObjects.Image>();
  private trayRenderIndexById = new Map<string, number>();
  private chromeObjects: Array<{ destroy: () => void }> = [];
  private boardTextureKey: string;
  private dragDepth = 10;
  private highlightTween: Phaser.Tweens.Tween | null = null;
  private currentLayout: PlayLayout | null = null;
  private currentTrayPage: number;
  private sceneReady = false;

  constructor(
    session: PuzzleSession,
    viewport: PlayViewport | null,
    currentTrayPage: number,
    onSessionChange: (session: PuzzleSession) => void,
    onPlaySound: (soundId: SoundId) => void
  ) {
    super('puzzle-board-scene');
    this.currentSession = session;
    this.currentViewport = viewport;
    this.currentTrayPage = currentTrayPage;
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
    this.sceneReady = true;
    this.registerInteractions();
    this.syncScene();
  }

  hydrate(session: PuzzleSession) {
    this.currentSession = session;
    if (this.sceneReady) {
      this.syncScene();
    }
  }

  setCurrentTrayPage(currentTrayPage: number) {
    this.currentTrayPage = currentTrayPage;

    if (this.sceneReady) {
      this.syncScene();
    }
  }

  setViewport(viewport: PlayViewport) {
    this.currentViewport = viewport;

    if (this.sceneReady) {
      this.syncScene();
    }
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

    const baseScale = this.getBaseScale(sprite);
    sprite.setDepth(9999);
    this.highlightTween = this.tweens.add({
      targets: sprite,
      scale: baseScale * 1.08,
      duration: 180,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        sprite.setScale(baseScale);
      }
    });
  }

  private syncScene() {
    const viewport = this.currentViewport;

    if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const looseTrayPieces = this.getLooseTrayPieces();

    const layout = buildPlayLayout({
      width: viewport.width,
      height: viewport.height,
      trayCollapsed: this.currentSession.trayCollapsed,
      pieceCount: looseTrayPieces.length,
      imageWidth: this.currentSession.definition.imageWidth,
      imageHeight: this.currentSession.definition.imageHeight
    });

    this.trayRenderIndexById = new Map(
      looseTrayPieces.map((piece, index) => [piece.id, index])
    );
    this.currentLayout = layout;
    this.renderBoardChrome(layout);
    this.syncSprites(layout);
  }

  private renderBoardChrome(layout: PlayLayout) {
    this.clearChrome();

    const board = layout.board.rect;
    const tray = layout.tray.rect;

    const boardImage = this.add.image(
      board.x + board.width / 2,
      board.y + board.height / 2,
      this.boardTextureKey
    );
    boardImage.setDisplaySize(board.width, board.height).setAlpha(0.14);
    this.chromeObjects.push(boardImage);

    this.chromeObjects.push(
      this.add
        .rectangle(
        board.x + board.width / 2,
        board.y + board.height / 2,
        board.width + BOARD_OUTLINE_PADDING,
        board.height + BOARD_OUTLINE_PADDING,
        0xfffbf2,
        0.2
      )
      .setStrokeStyle(4, 0x245670, 0.32)
      .setFillStyle(0xfffbf2, 0.2)
    );

    this.chromeObjects.push(
      this.add
        .rectangle(
          tray.x + tray.width / 2,
          tray.y + tray.height / 2,
          tray.width,
          tray.height,
          0xfffcf7,
          0.6
        )
        .setStrokeStyle(2, 0x245670, 0.14)
    );
  }

  private clearChrome() {
    this.chromeObjects.forEach((object) => object.destroy());
    this.chromeObjects = [];
  }

  private syncSprites(layout: PlayLayout) {
    const visiblePieceIds = new Set<string>();

    this.currentSession.pieces.forEach((piece) => {
      const placement = this.resolvePiecePlacement(piece, layout);
      const sprite = this.spriteMap.get(piece.id);

      if (!placement) {
        if (sprite) {
          sprite.destroy();
          this.spriteMap.delete(piece.id);
        }

        return;
      }

      visiblePieceIds.add(piece.id);

      if (sprite) {
        this.updatePieceSprite(sprite, piece, placement);
        return;
      }

      const nextSprite = this.createPieceSprite(piece, placement);
      this.spriteMap.set(piece.id, nextSprite);
    });

    for (const [pieceId, sprite] of this.spriteMap.entries()) {
      if (visiblePieceIds.has(pieceId)) {
        continue;
      }

      sprite.destroy();
      this.spriteMap.delete(pieceId);
    }
  }

  private createPieceSprite(piece: PuzzlePieceState, placement: PiecePlacement) {
    const textureKey = this.buildPieceTexture(piece);
    const sprite = this.add.image(placement.centerX, placement.centerY, textureKey);

    sprite.setData('pieceId', piece.id);
    sprite.setData('baseScale', placement.scale);
    sprite.setDisplaySize(
      this.currentSession.definition.pieceWidth * placement.scale,
      this.currentSession.definition.pieceHeight * placement.scale
    );
    sprite.setScale(placement.scale);
    sprite.setDepth(piece.fixed ? 1 : this.dragDepth += 1);
    sprite.setInteractive({ useHandCursor: !piece.fixed });

    if (piece.fixed) {
      sprite.disableInteractive();
    }

    this.input.setDraggable(sprite, !piece.fixed);
    sprite.setAlpha(piece.fixed ? 1 : 0.98);

    return sprite;
  }

  private updatePieceSprite(
    sprite: Phaser.GameObjects.Image,
    piece: PuzzlePieceState,
    placement: PiecePlacement
  ) {
    sprite.setData('pieceId', piece.id);
    sprite.setData('baseScale', placement.scale);
    sprite.setPosition(placement.centerX, placement.centerY);
    sprite.setDisplaySize(
      this.currentSession.definition.pieceWidth * placement.scale,
      this.currentSession.definition.pieceHeight * placement.scale
    );
    sprite.setScale(placement.scale);
    sprite.setAlpha(piece.fixed ? 1 : 0.98);

    if (piece.fixed) {
      sprite.disableInteractive();
      return;
    }

    sprite.setInteractive({ useHandCursor: true });
    this.input.setDraggable(sprite, true);
  }

  private registerInteractions() {
    this.input.on(
      'dragstart',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        const sprite = gameObject as Phaser.GameObjects.Image;
        const piece = this.getPiece(sprite);

        if (!piece || piece.fixed) {
          return;
        }

        this.onPlaySound('piece_pickup');
        sprite.setScale(this.getBaseScale(sprite) * 1.02);
        sprite.setDepth(this.dragDepth += 1);
      }
    );

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

      sprite.setScale(this.getBaseScale(sprite));
      const wasCompletedBefore = Boolean(this.currentSession.completedAt);
      const boardPoint = this.toBoardPoint(sprite);

      const result = snapPieceToBoard(this.currentSession, this.currentSession.definition, piece.id, {
        x: boardPoint.x,
        y: boardPoint.y
      });

      this.currentSession = result.session;
      this.syncScene();

      if (result.didSnap) {
        this.tweens.add({
          targets: sprite,
          scale: this.getBaseScale(sprite) * 1.05,
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

  private getPiece(sprite: Phaser.GameObjects.Image): PuzzlePieceState | undefined {
    const pieceId = sprite.getData('pieceId') as string;
    return this.currentSession.pieces.find((piece) => piece.id === pieceId);
  }

  private getBaseScale(sprite: Phaser.GameObjects.Image) {
    return (sprite.getData('baseScale') as number | undefined) ?? 1;
  }

  private getLooseTrayPieces() {
    return this.currentSession.pieces
      .filter(
        (piece): piece is PuzzlePieceState =>
          !piece.fixed && piece.zone === 'tray' && piece.traySlotIndex !== null
      )
      .sort((left, right) => {
        const leftIndex = left.traySlotIndex ?? Number.POSITIVE_INFINITY;
        const rightIndex = right.traySlotIndex ?? Number.POSITIVE_INFINITY;

        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }

        return left.id.localeCompare(right.id);
      });
  }

  private toBoardPoint(sprite: Phaser.GameObjects.Image) {
    const layout = this.currentLayout;
    const boardScaleX = layout
      ? layout.board.rect.width / this.currentSession.definition.board.width
      : 1;
    const boardScaleY = layout
      ? layout.board.rect.height / this.currentSession.definition.board.height
      : 1;
    const topLeftX = sprite.x - (this.currentSession.definition.pieceWidth * boardScaleX) / 2;
    const topLeftY = sprite.y - (this.currentSession.definition.pieceHeight * boardScaleY) / 2;

    if (!layout) {
      return {
        x: topLeftX,
        y: topLeftY
      };
    }

    const board = layout.board.rect;

    return {
      x: this.currentSession.definition.board.x + (topLeftX - board.x) / boardScaleX,
      y: this.currentSession.definition.board.y + (topLeftY - board.y) / boardScaleY
    };
  }

  private resolvePiecePlacement(piece: PuzzlePieceState, layout: PlayLayout): PiecePlacement | null {
    if (piece.fixed || piece.zone === 'board') {
      if (!piece.boardPosition) {
        return null;
      }

      const scale = layout.board.rect.width / this.currentSession.definition.board.width;
      const topLeftX = layout.board.rect.x + piece.boardPosition.x * layout.board.rect.width;
      const topLeftY = layout.board.rect.y + piece.boardPosition.y * layout.board.rect.height;

      return {
        centerX: topLeftX + (this.currentSession.definition.pieceWidth * scale) / 2,
        centerY: topLeftY + (this.currentSession.definition.pieceHeight * scale) / 2,
        scale
      };
    }

    const denseTrayIndex = this.trayRenderIndexById.get(piece.id);

    if (denseTrayIndex === undefined) {
      return null;
    }

    const pageSize = layout.tray.pageSize;
    const pageCount = layout.tray.pageCount;

    if (pageSize <= 0 || pageCount <= 0) {
      return null;
    }

    const activeTrayPage = Math.max(0, Math.min(this.currentTrayPage, pageCount - 1));

    if (Math.floor(denseTrayIndex / pageSize) !== activeTrayPage) {
      return null;
    }

    const slot = layout.tray.slots[denseTrayIndex % pageSize];

    if (!slot) {
      return null;
    }

    const scale = Math.min(
      slot.width / this.currentSession.definition.pieceWidth,
      slot.height / this.currentSession.definition.pieceHeight
    );
    const topLeftX = slot.x + (slot.width - this.currentSession.definition.pieceWidth * scale) / 2;
    const topLeftY = slot.y + (slot.height - this.currentSession.definition.pieceHeight * scale) / 2;

    return {
      centerX: topLeftX + (this.currentSession.definition.pieceWidth * scale) / 2,
      centerY: topLeftY + (this.currentSession.definition.pieceHeight * scale) / 2,
      scale
    };
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
  viewport,
  currentTrayPage,
  onPlaySound,
  onSessionChange
}: PuzzleBoardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PuzzleBoardScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const currentViewport = viewport ?? {
    width: FALLBACK_VIEWPORT_WIDTH,
    height: FALLBACK_VIEWPORT_HEIGHT
  };

  useEffect(() => {
    if (!hostRef.current) {
      return undefined;
    }

    const scene = new PuzzleBoardScene(
      session,
      viewport ?? null,
      currentTrayPage,
      onSessionChange,
      onPlaySound
    );
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: currentViewport.width,
      height: currentViewport.height,
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

    if (!game || !viewport?.width || !viewport?.height) {
      return;
    }

    game.scale.resize(viewport.width, viewport.height);
    sceneRef.current?.setViewport(viewport);
  }, [viewport]);

  useEffect(() => {
    sceneRef.current?.setCurrentTrayPage(currentTrayPage);
  }, [currentTrayPage]);

  return <div ref={hostRef} className="board-frame" />;
}
