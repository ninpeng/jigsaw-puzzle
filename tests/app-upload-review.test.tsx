import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pendingUpload = {
  title: 'Tall Photo',
  mimeType: 'image/jpeg',
  originalDataUrl: 'data:image/jpeg;base64,AAAA',
  originalWidth: 900,
  originalHeight: 1600,
  rotation: 90 as const,
  previewDataUrl: 'data:image/jpeg;base64,BBBB',
  previewThumbnailDataUrl: 'data:image/webp;base64,BBBB',
  previewWidth: 1600,
  previewHeight: 900
};

const rotatedSource = {
  id: 'upload-rotated',
  type: 'local_upload' as const,
  title: 'Tall Photo',
  imageDataUrl: 'data:image/jpeg;base64,CCCC',
  thumbnailDataUrl: 'data:image/webp;base64,DDDD',
  imageWidth: 1600,
  imageHeight: 900
};

const mocks = vi.hoisted(() => ({
  prepareLocalPuzzleUpload: vi.fn(),
  rotatePendingUpload: vi.fn(),
  finalizePendingUpload: vi.fn(),
  savePuzzleSource: vi.fn()
}));

vi.mock('../src/puzzle', async () => {
  const actual = await vi.importActual<typeof import('../src/puzzle')>('../src/puzzle');

  return {
    ...actual,
    createStorage: async () => ({
      close: vi.fn(),
      getSession: vi.fn(),
      getSource: vi.fn(),
      listSources: async () => [],
      saveSource: vi.fn(),
      listSessions: async () => [],
      saveSession: vi.fn(),
      deleteSession: vi.fn()
    }),
    savePuzzleSource: mocks.savePuzzleSource,
    savePuzzleSession: vi.fn()
  };
});

vi.mock('../src/app/audio/SoundProvider', () => ({
  SoundProvider: ({ children }: { children: ReactNode }) => children,
  useSound: () => ({
    enabled: true,
    play: vi.fn().mockResolvedValue(undefined),
    toggleEnabled: vi.fn(),
    unlock: vi.fn().mockResolvedValue(undefined)
  })
}));

vi.mock('../src/app/upload', () => ({
  prepareLocalPuzzleUpload: mocks.prepareLocalPuzzleUpload,
  rotatePendingUpload: mocks.rotatePendingUpload,
  finalizePendingUpload: mocks.finalizePendingUpload
}));

import { App } from '../src/app/App';

describe('App upload review flow', () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('opens portrait upload review before saving a source', async () => {
    mocks.prepareLocalPuzzleUpload.mockResolvedValue({
      kind: 'needs-rotation',
      pendingUpload
    });

    render(<App />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['portrait'], 'portrait.jpg', { type: 'image/jpeg' })]
      }
    });

    expect(await screen.findByText('세로 사진 회전')).toBeInTheDocument();
    expect(mocks.savePuzzleSource).not.toHaveBeenCalled();
  });

  it('saves the rotated source only after the review is confirmed and skips saving on cancel', async () => {
    mocks.prepareLocalPuzzleUpload.mockResolvedValue({
      kind: 'needs-rotation',
      pendingUpload
    });
    mocks.rotatePendingUpload.mockResolvedValue({
      ...pendingUpload,
      rotation: 270,
      previewDataUrl: 'data:image/jpeg;base64,EEEE'
    });
    mocks.finalizePendingUpload.mockReturnValue(rotatedSource);

    render(<App />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['portrait'], 'portrait.jpg', { type: 'image/jpeg' })]
      }
    });

    expect(await screen.findByText('세로 사진 회전')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '오른쪽으로 회전' }));
    await waitFor(() => {
      expect(mocks.rotatePendingUpload).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(mocks.savePuzzleSource).not.toHaveBeenCalled();

    fireEvent.change(input, {
      target: {
        files: [new File(['portrait'], 'portrait.jpg', { type: 'image/jpeg' })]
      }
    });

    expect(await screen.findByText('세로 사진 회전')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이 방향으로 사용' }));

    await waitFor(() => {
      expect(mocks.finalizePendingUpload).toHaveBeenCalled();
      expect(mocks.savePuzzleSource).toHaveBeenCalledWith(rotatedSource);
    });
  });
});
