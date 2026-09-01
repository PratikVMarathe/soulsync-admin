import { useRef, useState } from 'react';
import AdminIcon from '../AdminIcon';

export default function QuizCsvDropzone({
  fileInfo,
  isLoading = false,
  onFileSelect,
  onReset,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const lowerName = file.name.toLowerCase();
      if (
        lowerName.endsWith('.csv')
        || lowerName.endsWith('.zip')
        || file.type === 'text/csv'
        || file.type === 'application/zip'
        || file.type === 'application/x-zip-compressed'
      ) {
        onFileSelect(file);
      } else {
        onFileSelect(file, 'INVALID_TYPE');
      }
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileSelect(file);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  if (fileInfo) {
    const formattedSize = fileInfo.size < 1024 * 1024
      ? `${(fileInfo.size / 1024).toFixed(1)} KB`
      : `${(fileInfo.size / (1024 * 1024)).toFixed(2)} MB`;

    return (
      <div className="admin-csv-file-card">
        <div className="admin-csv-file-main">
          <div className="admin-csv-file-icon">
            <AdminIcon name="fileSpreadsheet" size={32} />
          </div>
          <div className="admin-csv-file-details">
            <strong className="admin-csv-file-name">{fileInfo.name}</strong>
            <div className="admin-csv-file-meta">
              <span>{formattedSize}</span>
              <span>•</span>
              <span>{fileInfo.rowCount} {fileInfo.rowCount === 1 ? 'row' : 'rows'}</span>
              <span>•</span>
              <span>{fileInfo.quizCount} {fileInfo.quizCount === 1 ? 'quiz' : 'quizzes'} detected</span>
              {fileInfo.imageCount ? (
                <>
                  <span>•</span>
                  <span>{fileInfo.imageCount} {fileInfo.imageCount === 1 ? 'image' : 'images'} in package</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <button
          aria-label="Remove and choose different CSV or ZIP file"
          className="ghost-cta is-compact admin-csv-change-btn"
          disabled={isLoading}
          onClick={onReset}
          type="button"
        >
          <AdminIcon name="close" size={16} />
          <span>Change File</span>
        </button>
      </div>
    );
  }

  return (
    <div
      aria-label="Upload CSV or ZIP File Dropzone"
      className={`admin-csv-dropzone ${isDragging ? 'is-dragging' : ''} ${isLoading ? 'is-loading' : ''}`}
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
        accept=".csv,.zip,text/csv,application/zip,application/x-zip-compressed"
        aria-label="Upload CSV or ZIP file input"
        className="admin-csv-hidden-input"
        disabled={isLoading}
        onChange={handleInputChange}
        ref={fileInputRef}
        type="file"
      />

      <div className="admin-csv-dropzone-content">
        <div className="admin-csv-dropzone-icon">
          <AdminIcon name="uploadCloud" size={40} />
        </div>
        <div className="admin-csv-dropzone-text">
          <strong style={{ color: '#245940' }}>Click to browse </strong><span> or drag & drop CSV or ZIP</span>
          <p>Standard CSV or ZIP archive containing <code>quizzes.csv</code> and <code>images/</code> folder</p>
          <p>Images max 500 KB each (JPG, PNG, WebP)</p>
        </div>
      </div>
    </div>
  );
}
