import { useState } from 'react';
import AdminIcon from '../AdminIcon';
import { formatQuizLevel } from '../../utils/formatters';
import { formatQuizStatusLabel } from '../../utils/quizManagement';

export default function QuizBulkUploadPreview({
  importProgress = null,
  isImporting = false,
  onCancel,
  onImport,
  quizzes = [],
  totalQuestionsCount = 0,
}) {
  const [expandedQuizSlugs, setExpandedQuizSlugs] = useState(new Set());

  const toggleExpand = (slug) => {
    setExpandedQuizSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  return (
    <section aria-label="Import Preview" className="admin-panel admin-bulk-upload-preview">
      <header className="admin-panel-header admin-bulk-preview-header">
        <div>
          <h2>Import Preview</h2>
          <p>
            {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'} • {totalQuestionsCount} {totalQuestionsCount === 1 ? 'question' : 'questions'} ready for import.
          </p>
        </div>

        <div className="admin-bulk-preview-header-badges">
          <span className="admin-badge is-accent">
            {quizzes.length} {quizzes.length === 1 ? 'Quiz' : 'Quizzes'}
          </span>
          <span className="admin-badge">
            {totalQuestionsCount} {totalQuestionsCount === 1 ? 'Question' : 'Questions'}
          </span>
        </div>
      </header>

      {isImporting && importProgress ? (
        <div className="admin-bulk-progress-panel">
          <div className="admin-bulk-progress-header">
            <strong>Importing quizzes to Firestore...</strong>
            <span>
              {importProgress.processedCount} / {importProgress.totalCount} ({importProgress.percentage}%)
            </span>
          </div>
          <div className="admin-bulk-progress-bar-track">
            <div
              className="admin-bulk-progress-bar-fill"
              style={{ width: `${importProgress.percentage}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="admin-bulk-preview-grid">
        {quizzes.map((quiz) => {
          const isExpanded = expandedQuizSlugs.has(quiz.slug);
          const estimatedMins = Math.round(quiz.estimatedTime / 60) || 1;

          return (
            <article className="admin-card admin-bulk-quiz-card" key={quiz.slug}>
              <div className="admin-bulk-quiz-header">
                <div>
                  <h3 className="admin-bulk-quiz-title">{quiz.title}</h3>
                  <code className="admin-bulk-quiz-slug">{quiz.slug}</code>
                </div>

                <div className="admin-bulk-quiz-badges">
                  <span className={`admin-badge ${quiz.status === 'ACTIVE' ? 'is-success' : 'is-warning'}`}>
                    {formatQuizStatusLabel(quiz.status)}
                  </span>
                  <span className="admin-badge">{formatQuizLevel(quiz.level)}</span>
                  <span className="admin-badge is-accent">
                    {quiz.questions.length} {quiz.questions.length === 1 ? 'Question' : 'Questions'}
                  </span>
                </div>
              </div>

              {quiz.description ? (
                <p className="admin-bulk-quiz-desc">{quiz.description}</p>
              ) : null}

              <div className="admin-bulk-quiz-meta">
                <span>Category: <strong>{quiz.category || 'None'}</strong></span>
                <span>•</span>
                <span>Time: <strong>{estimatedMins} {estimatedMins === 1 ? 'min' : 'mins'}</strong></span>
                <span>•</span>
                <span>Retakes: <strong>{quiz.allowRetake ? 'Allowed' : 'Disabled'}</strong></span>
              </div>

              <div className="admin-bulk-quiz-questions-section">
                <button
                  aria-expanded={isExpanded}
                  className="ghost-cta is-compact admin-bulk-toggle-questions-btn"
                  onClick={() => toggleExpand(quiz.slug)}
                  type="button"
                >
                  <AdminIcon name="chevron" size={16} />
                  <span>
                    {isExpanded ? 'Hide Questions' : `View Questions (${quiz.questions.length})`}
                  </span>
                </button>

                {isExpanded ? (
                  <ul className="admin-bulk-question-list">
                    {quiz.questions.map((q, qIndex) => (
                      <li className="admin-bulk-question-item" key={q.id || `q-${qIndex}`}>
                        <div className="admin-bulk-question-header">
                          <span className="admin-bulk-question-badge">
                            <AdminIcon name="checkCircle" size={14} />
                            {q.id}
                          </span>
                          <strong className="admin-bulk-question-text">{q.text}</strong>
                          <span className="admin-bulk-question-time">{q.time}s</span>
                        </div>
                        <div className="admin-bulk-question-options">
                          {q.options.map((opt, optIndex) => (
                            <span
                              className={`admin-bulk-option-chip ${optIndex === q.correctIndex ? 'is-correct' : ''}`}
                              key={`opt-${q.id}-${optIndex}`}
                            >
                              {optIndex + 1}. {opt} {optIndex === q.correctIndex ? '✓' : ''}
                            </span>
                          ))}
                        </div>
                        {q.references && q.references.length > 0 && q.references[0].source ? (
                          <div className="admin-bulk-question-ref">
                            <em>Ref: {q.references[0].source} {q.references[0].chapter ? `Ch ${q.references[0].chapter}` : ''}{q.references[0].verse ? `:${q.references[0].verse}` : ''}</em>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <footer className="admin-panel-footer admin-bulk-preview-footer">
        <button
          className="secondary-cta"
          disabled={isImporting}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>

        <button
          className="primary-cta admin-bulk-import-btn"
          disabled={isImporting || quizzes.length === 0}
          onClick={onImport}
          type="button"
        >
          <AdminIcon name="uploadCloud" size={18} />
          <span>
            {isImporting
              ? 'Importing Quizzes...'
              : `Import ${quizzes.length} ${quizzes.length === 1 ? 'Quiz' : 'Quizzes'}`}
          </span>
        </button>
      </footer>
    </section>
  );
}
