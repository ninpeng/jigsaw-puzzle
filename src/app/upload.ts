import type { PuzzleSource } from '../puzzle';

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

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

function createThumbnailDataUrl(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return image.src;
  }

  const targetWidth = 360;
  const targetHeight = 220;
  const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.fillStyle = '#f9f1dd';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL('image/webp', 0.88);
}

export async function createLocalPuzzleSource(file: File): Promise<PuzzleSource> {
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

  return {
    id: `upload-${globalThis.crypto.randomUUID()}`,
    type: 'local_upload',
    title: file.name.replace(/\.[^.]+$/, '') || 'My Puzzle',
    imageDataUrl: dataUrl,
    thumbnailDataUrl: createThumbnailDataUrl(image),
    imageWidth: image.width,
    imageHeight: image.height
  };
}
