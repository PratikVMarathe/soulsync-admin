import AdminIcon from '../AdminIcon';

export default function QuizBulkUploadErrors({ errors = [] }) {
  if (!errors || errors.length === 0) return null;

  return (
    <section aria-label="Validation Errors" className="admin-panel admin-bulk-upload-errors">
      <header className="admin-panel-header admin-bulk-errors-header">
        <div className="admin-bulk-errors-title-group">
          <div className="admin-bulk-errors-icon">
            <AdminIcon name="alertCircle" size={24} />
          </div>
          <div>
            <h2>
              {errors.length} {errors.length === 1 ? 'Validation Error' : 'Validation Errors'} Found
            </h2>
            <p>Please resolve all errors in your CSV file before importing quizzes.</p>
          </div>
        </div>
      </header>

      <div className="admin-bulk-error-list">
        {errors.map((error, index) => (
          <article className="admin-bulk-error-card" key={`error-${index}-${error.row}-${error.field}`}>
            <div className="admin-bulk-error-meta">
              {error.row ? (
                <span className="admin-badge admin-bulk-error-row-badge">
                  Row {error.row}
                </span>
              ) : null}
              {error.quizSlug ? (
                <span className="admin-badge admin-bulk-error-slug-badge">
                  Quiz: {error.quizSlug}
                </span>
              ) : null}
              {error.field ? (
                <span className="admin-badge admin-bulk-error-field-badge">
                  Field: {error.field}
                </span>
              ) : null}
            </div>
            <p className="admin-bulk-error-message">{error.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
