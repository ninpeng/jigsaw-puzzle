export type PuzzleSourceType = 'built_in' | 'local_upload';

export type ConnectorValue = -1 | 0 | 1;

export interface PuzzleSource {
  id: string;
  type: PuzzleSourceType;
  title: string;
  imageDataUrl: string;
  thumbnailDataUrl: string;
  imageWidth: number;
  imageHeight: number;
}

export interface DifficultyPreset {
  id: 'easy' | 'medium' | 'hard';
  label: string;
  rows: number;
  cols: number;
  snapDistance: number;
}

export interface PieceConnectors {
  top: ConnectorValue;
  right: ConnectorValue;
  bottom: ConnectorValue;
  left: ConnectorValue;
}

export interface PuzzlePieceDefinition {
  id: string;
  row: number;
  col: number;
  homeX: number;
  homeY: number;
  isEdge: boolean;
  connectors: PieceConnectors;
}

export interface PuzzleBoardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PuzzleDefinition {
  id: string;
  sourceId: string;
  sourceType: PuzzleSourceType;
  sourceTitle: string;
  imageDataUrl: string;
  thumbnailDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  preset: DifficultyPreset;
  board: PuzzleBoardBounds;
  pieceWidth: number;
  pieceHeight: number;
  pieces: PuzzlePieceDefinition[];
}

export interface AssistAction {
  type: 'hint' | 'separate_edges';
  timestamp: string;
  pieceId?: string;
}

export type PieceZone = 'board' | 'tray';

export interface PuzzlePieceState extends PuzzlePieceDefinition {
  x: number;
  y: number;
  fixed: boolean;
  zone: PieceZone;
}

export interface PuzzleSession {
  id: string;
  definition: PuzzleDefinition;
  pieces: PuzzlePieceState[];
  startedAt: string;
  lastUpdatedAt: string;
  elapsedMs: number;
  completedAt: string | null;
  assistActions: AssistAction[];
  trayCollapsed: boolean;
}

export interface PuzzleSessionSummary {
  id: string;
  sourceTitle: string;
  presetLabel: string;
  completionRatio: number;
  lastUpdatedAt: string;
  completedAt: string | null;
}
