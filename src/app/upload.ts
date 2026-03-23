import type { PuzzleSource } from '../puzzle';

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;
const THUMBNAIL_WIDTH = 360;
const THUMBNAIL_HEIGHT = 220;

export interface PendingUploadImage {
  title: string;
  mimeType: string;
  originalDataUrl: string;
  originalWidth: number;
  originalHeight: number;
  rotation: 90 | 270;
  previewDataUrl: string;
  previewThumbnailDataUrl: string;
  previewWidth: number;
  previewHeight: number;
}

export type PreparedLocalPuzzleUpload =
  | { kind: 'ready'; source: PuzzleSource }
  | { kind: 'needs-rotation'; pendingUpload: PendingUploadImage };

interface UploadImageMetadata {
  mimeType: string;
  width: number;
  height: number;
}

interface UploadValidationResult {
  ok: boolean;
  error: string | null;
}

export function validateUploadImageMetadata(metadata: UploadImageMetadata): UploadValidationResult {
  if (!metadata.mimeType.startsWith('image/')) {
    return {
      ok: false,
      error: 'PNG, JPG, WebP 같은 이미지 파일만 업로드할 수 있습니다.'
    };
  }

  if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
    return {
      ok: false,
      error: '최소 640x480 이상의 이미지를 선택해 주세요.'
    };
  }

  return {
    ok: true,
    error: null
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 해석할 수 없습니다.'));
    image.src = dataUrl;
  });
}

function createThumbnailDataUrlFromSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number
): string {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return typeof source === 'string' ? source : '';
  }

  const scale = Math.max(THUMBNAIL_WIDTH / sourceWidth, THUMBNAIL_HEIGHT / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (THUMBNAIL_WIDTH - drawWidth) / 2;
  const offsetY = (THUMBNAIL_HEIGHT - drawHeight) / 2;

  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  context.fillStyle = '#f9f1dd';
  context.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL('image/webp', 0.88);
}

function createThumbnailDataUrl(image: HTMLImageElement): string {
  return createThumbnailDataUrlFromSource(image, image.width, image.height);
}

function resolveOutputMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp') {
    return mimeType;
  }

  return 'image/png';
}

function renderRotatedCanvas(image: HTMLImageElement, rotation: 90 | 270) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 회전 미리보기를 만들 수 없습니다.');
  }

  canvas.width = image.height;
  canvas.height = image.width;
  context.save();

  if (rotation === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  }

  context.drawImage(image, 0, 0, image.width, image.height);
  context.restore();

  return canvas;
}

function createPuzzleSourceFromImage(params: {
  title: string;
  mimeType: string;
  dataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
}): PuzzleSource {
  return {
    id: `upload-${globalThis.crypto.randomUUID()}`,
    type: 'local_upload',
    title: params.title,
    imageDataUrl: params.dataUrl,
    thumbnailDataUrl: params.thumbnailDataUrl,
    imageWidth: params.width,
    imageHeight: params.height
  };
}

function buildPendingUploadImage(
  title: string,
  mimeType: string,
  originalDataUrl: string,
  image: HTMLImageElement,
  rotation: 90 | 270
): PendingUploadImage {
  const rotatedCanvas = renderRotatedCanvas(image, rotation);
  const outputMimeType = resolveOutputMimeType(mimeType);
  const previewDataUrl = rotatedCanvas.toDataURL(outputMimeType, 0.92);

  return {
    title,
    mimeType: outputMimeType,
    originalDataUrl,
    originalWidth: image.width,
    originalHeight: image.height,
    rotation,
    previewDataUrl,
    previewThumbnailDataUrl: createThumbnailDataUrlFromSource(
      rotatedCanvas,
      rotatedCanvas.width,
      rotatedCanvas.height
    ),
    previewWidth: rotatedCanvas.width,
    previewHeight: rotatedCanvas.height
  };
}

export async function prepareLocalPuzzleUpload(file: File): Promise<PreparedLocalPuzzleUpload> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const validation = validateUploadImageMetadata({
    mimeType: file.type,
    width: image.width,
    height: image.height
  });

  if (!validation.ok) {
    throw new Error(validation.error ?? '업로드 이미지를 사용할 수 없습니다.');
  }

  const title = file.name.replace(/\.[^.]+$/, '') || 'My Puzzle';

  if (image.width >= image.height) {
    return {
      kind: 'ready',
      source: createPuzzleSourceFromImage({
        title,
        mimeType: resolveOutputMimeType(file.type),
        dataUrl,
        thumbnailDataUrl: createThumbnailDataUrl(image),
        width: image.width,
        height: image.height
      })
    };
  }

  return {
    kind: 'needs-rotation',
    pendingUpload: buildPendingUploadImage(title, file.type, dataUrl, image, 90)
  };
}

export async function rotatePendingUpload(
  pendingUpload: PendingUploadImage,
  direction: 'left' | 'right'
): Promise<PendingUploadImage> {
  const image = await loadImage(pendingUpload.originalDataUrl);
  const rotation = direction === 'right' ? 90 : 270;

  return buildPendingUploadImage(
    pendingUpload.title,
    pendingUpload.mimeType,
    pendingUpload.originalDataUrl,
    image,
    rotation
  );
}

export function finalizePendingUpload(pendingUpload: PendingUploadImage): PuzzleSource {
  return createPuzzleSourceFromImage({
    title: pendingUpload.title,
    mimeType: pendingUpload.mimeType,
    dataUrl: pendingUpload.previewDataUrl,
    thumbnailDataUrl: pendingUpload.previewThumbnailDataUrl,
    width: pendingUpload.previewWidth,
    height: pendingUpload.previewHeight
  });
}

export async function createLocalPuzzleSource(file: File): Promise<PuzzleSource> {
  const preparedUpload = await prepareLocalPuzzleUpload(file);

  if (preparedUpload.kind === 'ready') {
    return preparedUpload.source;
  }

  return finalizePendingUpload(preparedUpload.pendingUpload);
}
