import type { PendingUploadImage } from '../upload';

interface UploadReviewDialogProps {
  pendingUpload: PendingUploadImage;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UploadReviewDialog({
  pendingUpload,
  onRotateLeft,
  onRotateRight,
  onCancel,
  onConfirm
}: UploadReviewDialogProps) {
  return (
    <div className="upload-review-backdrop" role="presentation">
      <section className="upload-review-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-review-title">
        <div className="upload-review-copy">
          <span className="eyebrow">Landscape Puzzle</span>
          <h2 id="upload-review-title">세로 사진 회전</h2>
          <p>
            퍼즐은 항상 가로형으로 플레이합니다. 미리보기를 확인하고 원하는 방향으로 돌린 뒤
            사용해 주세요.
          </p>
        </div>

        <div className="upload-review-preview">
          <img
            src={pendingUpload.previewDataUrl}
            alt={`${pendingUpload.title} rotation preview`}
          />
        </div>

        <div className="upload-review-controls">
          <button type="button" className="ghost-button" onClick={onRotateLeft}>
            왼쪽으로 회전
          </button>
          <button type="button" className="ghost-button" onClick={onRotateRight}>
            오른쪽으로 회전
          </button>
        </div>

        <div className="upload-review-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="accent-button" onClick={onConfirm}>
            이 방향으로 사용
          </button>
        </div>
      </section>
    </div>
  );
}
