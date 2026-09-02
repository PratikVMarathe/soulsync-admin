import { useEffect, useState } from 'react';
import AdminIcon from './AdminIcon';
import { copyImageUrl } from '../services/cloudinaryService';
import { useAppNotice } from '../hooks/useAppNotice';

export default function ImagePreviewDialog({
  isOpen,
  onClose,
  title = 'Image Preview',
  url,
}) {
  const { showNotice } = useAppNotice();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [url, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !url) return null;

  const handleCopy = () => {
    copyImageUrl(url, showNotice);
  };

  return (
    <div
      aria-labelledby="image-preview-title"
      aria-modal="true"
      className="admin-dialog-backdrop"
      role="dialog"
    >
      <div className="admin-dialog-card admin-image-preview-card">
        <header className="admin-dialog-header">
          <div>
            <h3 id="image-preview-title">{title}</h3>
            <p>Direct view of the uploaded media asset.</p>
          </div>
          <button
            aria-label="Close dialog"
            className="ghost-cta is-compact admin-dialog-close"
            onClick={onClose}
            type="button"
          >
            <AdminIcon name="close" size={18} />
          </button>
        </header>

        <div className="admin-image-preview-viewport">
          {imageError ? (
            <div className="admin-image-preview-placeholder is-error">
              <AdminIcon name="alertTriangle" size={32} />
              <span>Failed to load image preview from URL.</span>
            </div>
          ) : (
            <img
              alt="Asset Preview"
              className="admin-image-preview-element"
              onError={() => setImageError(true)}
              src={url}
            />
          )}
        </div>

        <div className="admin-image-preview-meta">
          <label className="admin-profile-field">
            <span>Image URL</span>
            <div className="admin-copy-field-group">
              <input
                aria-label="Image URL Value"
                readOnly
                type="text"
                value={url}
              />
              <button
                className="secondary-cta is-compact"
                onClick={handleCopy}
                type="button"
              >
                <AdminIcon name="copy" size={16} />
                <span>Copy Link</span>
              </button>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
