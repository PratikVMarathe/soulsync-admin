import { useEffect, useState } from 'react';
import AdminIcon from './AdminIcon';
import { formatQuizStatusLabel } from '../utils/quizManagement';

function getStatusBadgeClass(status) {
  if (status === 'ACTIVE') return 'is-active';
  if (status === 'DRAFT') return 'is-draft';
  return 'is-inactive';
}

export default function QuizSequenceDialog({
  isOpen,
  isSaving = false,
  onClose,
  onSave,
  quizzes = [],
}) {
  const [items, setItems] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Sort initial list by existing sequence ASC, with fallback to title
      const sorted = [...quizzes].sort((a, b) => {
        const seqA = typeof a.sequence === 'number' ? a.sequence : Number.MAX_SAFE_INTEGER;
        const seqB = typeof b.sequence === 'number' ? b.sequence : Number.MAX_SAFE_INTEGER;
        if (seqA !== seqB) return seqA - seqB;
        return (a.title || '').localeCompare(b.title || '');
      });
      setItems(sorted);
    }
  }, [isOpen, quizzes]);

  if (!isOpen) return null;

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setItems(updated);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveItem(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    if (!onSave) return;
    const sequencePayload = items.map((quiz, index) => ({
      id: quiz.id,
      sequence: index + 1,
      title: quiz.title,
    }));
    await onSave(sequencePayload);
  };

  return (
    <div
      aria-labelledby="quiz-sequence-title"
      aria-modal="true"
      className="admin-dialog-backdrop"
      role="dialog"
    >
      <div className="admin-dialog-card admin-quiz-sequence-card" style={{ maxWidth: '640px', width: '92%' }}>
        <header className="admin-dialog-header">
          <div>
            <h3 id="quiz-sequence-title">Manage Quiz Sequence</h3>
            <p>Drag items or use the arrows to reorder. Active quizzes will appear to users in this sequence.</p>
          </div>
          <button
            aria-label="Close dialog"
            className="ghost-cta is-compact admin-dialog-close"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <AdminIcon name="close" size={18} />
          </button>
        </header>

        <div className="admin-sequence-list-body" style={{ maxHeight: '420px', overflowY: 'auto', padding: '1rem' }}>
          {items.length === 0 ? (
            <div className="admin-empty-state">No quizzes found to order.</div>
          ) : (
            <ul className="admin-sequence-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {items.map((quiz, index) => {
                const isDragging = draggedIndex === index;
                return (
                  <li
                    className={`admin-sequence-item${isDragging ? ' is-dragging' : ''}`}
                    draggable={!isSaving}
                    key={quiz.id}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      background: isDragging ? '#e2e8f0' : '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '0.65rem 0.85rem',
                      userSelect: 'none',
                      cursor: 'grab',
                      transition: 'background 120ms ease, box-shadow 120ms ease',
                    }}
                  >
                    <span
                      className="admin-sequence-badge"
                      style={{
                        background: '#e6f4ea',
                        color: '#137333',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        minWidth: '2.4rem',
                        textAlign: 'center',
                      }}
                    >
                      #{index + 1}
                    </span>

                    <span className="admin-sequence-grip" style={{ color: '#94a3b8', display: 'flex' }}>
                      <AdminIcon name="grip" size={18} />
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '0.92rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {quiz.title || 'Untitled Quiz'}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {quiz.category || 'Wisdom'} • {quiz.totalQuestions || quiz.questions?.length || 0} Ques
                        </span>
                        <span
                          className={`admin-status-chip ${getStatusBadgeClass(quiz.status)}`}
                          style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: '4px' }}
                        >
                          {formatQuizStatusLabel(quiz.status)}
                        </span>
                      </div>
                    </div>

                    <div className="admin-sequence-actions" style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        aria-label={`Move ${quiz.title || 'quiz'} up`}
                        className="admin-icon-button is-small"
                        disabled={isSaving || index === 0}
                        onClick={() => moveItem(index, index - 1)}
                        style={{ width: '2rem', height: '2rem' }}
                        type="button"
                      >
                        <AdminIcon name="arrowUp" size={14} />
                      </button>

                      <button
                        aria-label={`Move ${quiz.title || 'quiz'} down`}
                        className="admin-icon-button is-small"
                        disabled={isSaving || index === items.length - 1}
                        onClick={() => moveItem(index, index + 1)}
                        style={{ width: '2rem', height: '2rem' }}
                        type="button"
                      >
                        <AdminIcon name="arrowDown" size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="admin-dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0' }}>
          <button
            className="secondary-cta is-compact"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="primary-cta is-compact"
            disabled={isSaving || items.length === 0}
            onClick={handleSave}
            type="button"
          >
            <span>{isSaving ? 'Saving Sequence...' : 'Save Sequence'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
