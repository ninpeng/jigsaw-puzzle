import { validateUploadImageMetadata } from '../src/app/upload';

describe('validateUploadImageMetadata', () => {
  it('rejects non-image files', () => {
    expect(
      validateUploadImageMetadata({
        mimeType: 'text/plain',
        width: 1600,
        height: 900
      })
    ).toEqual({
      ok: false,
      error: 'PNG, JPG, WebP 같은 이미지 파일만 업로드할 수 있습니다.'
    });
  });

  it('rejects images that are too small for puzzle generation', () => {
    expect(
      validateUploadImageMetadata({
        mimeType: 'image/png',
        width: 320,
        height: 240
      })
    ).toEqual({
      ok: false,
      error: '최소 640x480 이상의 이미지를 선택해 주세요.'
    });
  });

  it('accepts reasonably sized browser-safe images', () => {
    expect(
      validateUploadImageMetadata({
        mimeType: 'image/webp',
        width: 1440,
        height: 900
      })
    ).toEqual({
      ok: true,
      error: null
    });
  });
});
