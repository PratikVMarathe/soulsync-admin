import { useEffect, useRef, useState } from 'react';
import AdminIcon from './AdminIcon';
import { uploadImageToCloudinary, validateImageFile } from '../services/cloudinaryService';
import { UPLOAD_FOLDERS } from '../constants/upload';
import { useAppNotice } from '../hooks/useAppNotice';

export default function ImageUploadDialog({
  folder = UPLOAD_FOLDERS.QUIZ,
  isOpen,
  onClose,
  onSuccess,
  title = 'Upload Image',
  viewer,
}) {
  const { showNotice } = useAppNotice();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsDragging(false);
      setIsUploading(false);
      setUploadError('');
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen || isUploading) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUploading, onClose]);

  if (!isOpen) return null;

  const handleProcessFile = async (file) => {
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      showNotice(validation.error, 'error');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const result = await uploadImageToCloudinary(file, folder, viewer);
      showNotice('Image uploaded successfully.', 'success');
      onSuccess?.(result.secureUrl);
      onClose?.();
    } catch (err) {
      console.error('Image upload failed:', err);
      const message = err.message || 'Image upload failed. Please try again.';
      setUploadError(message);
      showNotice(message, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleProcessFile(file);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleProcessFile(file);
    }
  };

  const handleBrowseClick = () => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div
      aria-labelledby="image-upload-title"
      aria-modal="true"
      className="admin-dialog-backdrop"
      role="dialog"
    >
      <div className="admin-dialog-card admin-image-upload-card">
        <header className="admin-dialog-header">
          <div>
            <h3 id="image-upload-title">{title}</h3>
            <p>Upload a media asset to Cloudinary.</p>
          </div>
          <button
            aria-label="Close dialog"
            className="ghost-cta is-compact admin-dialog-close"
            disabled={isUploading}
            onClick={onClose}
            type="button"
          >
            <AdminIcon name="close" size={18} />
          </button>
        </header>

        <div className="admin-image-upload-viewport">
          {isUploading ? (
            <div className="admin-image-upload-status">
              <div className="admin-image-upload-spinner" />
              <strong>Uploading image to Cloud…</strong>
              <p className="admin-form-hint">Please wait while the image is being processed and saved.</p>
            </div>
          ) : (
            <div
              aria-label="Upload image dropzone"
              className={`admin-image-upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onClick={handleBrowseClick}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBrowseClick();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <input
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                aria-label="Image file input"
                className="admin-csv-hidden-input"
                disabled={isUploading}
                onChange={handleInputChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
                type="file"
              />

              <div className="admin-image-upload-content">
                <div className="admin-image-upload-icon">
                  <AdminIcon name="uploadCloud" size={32} />
                </div>
                <div className="admin-image-upload-text">
                  <strong style={{ color: '#245940' }}>Click to browse</strong>
                  <span> or drag & drop your Image</span>
                  <p>Images max 500 KB each (JPG, PNG, WebP)</p>
                </div>
              </div>
            </div>
          )}

          {uploadError ? (
            <div className="admin-image-upload-error">
              <AdminIcon name="alertTriangle" size={16} />
              <span>{uploadError}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
