import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AdminIcon from './AdminIcon';
import QuestionEditor from './QuestionEditor';
import QuestionNavigator from './QuestionNavigator';
import { useAppNotice } from '../hooks/useAppNotice';
import {
  buildQuizPayloadFromForm,
  createEmptyQuestion,
  getRemainingQuestionTime,
  validateQuizPayload,
  validateSingleQuestion,
} from '../utils/quizManagement';

export default function QuestionManagementDialog({
  fieldErrors = {},
  formState,
  isOpen,
  onAddQuestion,
  onAddReference,
  onClose,
  onRemoveQuestion,
  onRemoveReference,
  onSave,
  onUpdateOption,
  onUpdateQuestion,
  onUpdateReference,
  setFieldErrors,
  setFormState,
}) {
  const { showNotice } = useAppNotice();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [validationSummary, setValidationSummary] = useState([]);

  const questions = formState?.questions || [];
  const totalQuestions = questions.length;
  const [snapshot, setSnapshot] = useState(() => JSON.parse(JSON.stringify(questions)));

  // Initialize or capture snapshot when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSnapshot(JSON.parse(JSON.stringify(questions)));
      setValidationSummary([]);
      // Ensure currentQuestionIndex is within bounds
      setCurrentQuestionIndex((prev) => Math.min(prev, Math.max(0, questions.length - 1)));
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep index within valid bounds whenever questions array changes
  useEffect(() => {
    if (questions.length === 0) {
      setCurrentQuestionIndex(0);
    } else if (currentQuestionIndex >= questions.length) {
      setCurrentQuestionIndex(questions.length - 1);
    }
  }, [questions.length, currentQuestionIndex]);

  // Check dirty state
  const isDirty = useMemo(() => {
    if (!snapshot) return false;
    return JSON.stringify(questions) !== JSON.stringify(snapshot);
  }, [questions, snapshot]);

  // Safe Close Request
  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedPrompt(true);
    } else {
      onClose?.();
    }
  }, [isDirty, onClose]);

  // Discard changes and close
  const handleDiscardChanges = () => {
    setFormState?.((prev) => ({
      ...prev,
      questions: JSON.parse(JSON.stringify(snapshot)),
    }));
    setShowUnsavedPrompt(false);
    onClose?.();
  };

  // Add question handler
  const handleAddQuestion = () => {
    const remainingTime = getRemainingQuestionTime(questions, formState?.estimatedTime);
    if (remainingTime <= 0) {
      showNotice('No timer budget remains. Increase estimated time first.', 'error');
      return;
    }

    const nextIndex = questions.length;
    const newQuestion = createEmptyQuestion(nextIndex, remainingTime);

    setFormState?.((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));

    setCurrentQuestionIndex(nextIndex);
    showNotice('Question added.', 'success');
  };

  // Remove question handler
  const handleRemoveQuestion = (index) => {
    const nextQuestions = questions.filter((_, i) => i !== index);
    setFormState?.((prev) => ({
      ...prev,
      questions: nextQuestions,
    }));

    // Select nearest valid question index
    const nextIndex = Math.max(0, Math.min(index, nextQuestions.length - 1));
    setCurrentQuestionIndex(nextIndex);
    showNotice('Question removed.', 'info');
  };

  // Next button click
  const handleNext = () => {
    if (totalQuestions === 0) return;

    const currentQuestion = questions[currentQuestionIndex];
    const errors = validateSingleQuestion(currentQuestion, currentQuestionIndex);

    if (Object.keys(errors).length > 0) {
      setFieldErrors?.((prev) => ({ ...prev, ...errors }));
      showNotice('Please complete this question before proceeding.', 'error');
      return;
    }

    // Clear resolved errors for this question
    setFieldErrors?.((prev) => {
      const next = { ...prev };
      delete next[`question-${currentQuestionIndex}-text`];
      delete next[`question-${currentQuestionIndex}-options`];
      delete next[`question-${currentQuestionIndex}-correctIndex`];
      delete next[`question-${currentQuestionIndex}-time`];
      return next;
    });

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  // Previous button click
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  // Save changes button click
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    setValidationSummary([]);

    try {
      // Check question errors across all questions
      const collectedErrors = {};
      const questionErrors = [];

      questions.forEach((question, index) => {
        const qErrors = validateSingleQuestion(question, index);
        Object.entries(qErrors).forEach(([key, message]) => {
          collectedErrors[key] = message;
          const match = key.match(/^question-(\d+)-(.+)$/);
          if (match) {
            questionErrors.push({
              field: match[2],
              index,
              message,
              questionNumber: index + 1,
            });
          }
        });
      });

      if (questionErrors.length > 0) {
        setFieldErrors?.((prev) => ({ ...prev, ...collectedErrors }));
        setValidationSummary(questionErrors);
        showNotice(`Cannot save quiz. ${questionErrors.length} question error${questionErrors.length === 1 ? '' : 's'} require attention.`, 'error');
        setIsSaving(false);
        return;
      }

      // If valid, save
      await onSave(formState.status === 'DRAFT' ? 'draft' : 'save');
      setSnapshot(JSON.parse(JSON.stringify(questions)));
      setValidationSummary([]);
      showNotice('Questions saved successfully.', 'success');
    } catch (saveError) {
      showNotice(saveError?.publicMessage || 'Could not save quiz questions. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !showUnsavedPrompt) {
        handleRequestClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showUnsavedPrompt, handleRequestClose]);

  if (!isOpen) return null;

  const currentQuestion = questions[currentQuestionIndex];
  const isFirst = currentQuestionIndex === 0;
  const isLast = currentQuestionIndex === totalQuestions - 1 || totalQuestions === 0;

  return (
    <div
      aria-label="Question Management Workspace"
      aria-modal="true"
      className="admin-modal-overlay admin-question-dialog-overlay"
      role="dialog"
    >
      <div className="admin-modal admin-question-dialog">
        {/* Dialog Header */}
        <header className="admin-modal-header admin-question-dialog-header">
          <div className="admin-question-dialog-header-left">
            <AdminIcon name="book" size={22} />
            <div className="admin-question-dialog-header-title-group">
              <strong>Questions</strong>
              <span className="admin-badge admin-question-count-badge">
                <span className="admin-count-full">{totalQuestions} Question{totalQuestions === 1 ? '' : 's'}</span>
                <span className="admin-count-short">{totalQuestions}</span>
              </span>
            </div>
          </div>

          <div className="admin-question-dialog-header-actions">
            <button
              className="primary-cta is-compact admin-question-add-btn"
              onClick={handleAddQuestion}
              type="button"
            >
              <AdminIcon name="plus" size={16} />
              <span className="admin-btn-label-full">Add Question</span>
              <span className="admin-btn-label-short">Add</span>
            </button>

            <button
              aria-label="Close question management dialog"
              className="admin-icon-button admin-question-dialog-close"
              onClick={handleRequestClose}
              type="button"
            >
              <AdminIcon name="close" size={18} />
            </button>
          </div>
        </header>

        {/* Validation Summary Notification Banner (if any) */}
        {validationSummary.length > 0 ? (
          <div className="admin-question-validation-summary" role="alert">
            <div className="admin-question-validation-summary-header">
              <AdminIcon name="fire" size={18} />
              <strong>{validationSummary.length} question{validationSummary.length === 1 ? '' : 's'} require attention:</strong>
            </div>
            <ul className="admin-question-validation-summary-list">
              {validationSummary.map((err, i) => (
                <li key={`${err.index}-${err.field}-${i}`}>
                  <button
                    className="admin-question-validation-jump-btn"
                    onClick={() => setCurrentQuestionIndex(err.index)}
                    type="button"
                  >
                    <strong>Q{err.questionNumber}</strong>: {err.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Dialog Body (Desktop Side-by-Side / Mobile Stacked) */}
        <div className="admin-question-dialog-body">
          {/* Question Navigator */}
          <QuestionNavigator
            currentIndex={currentQuestionIndex}
            fieldErrors={fieldErrors}
            onSelectQuestion={(index) => setCurrentQuestionIndex(index)}
            questions={questions}
            variant="auto"
          />

          {/* Question Editor Pane */}
          <div className="admin-question-editor-pane">
            <QuestionEditor
              estimatedTime={formState?.estimatedTime}
              fieldErrors={fieldErrors}
              isEmpty={totalQuestions === 0}
              onAddQuestion={handleAddQuestion}
              onAddReference={onAddReference}
              onRemoveQuestion={handleRemoveQuestion}
              onRemoveReference={onRemoveReference}
              onUpdateOption={onUpdateOption}
              onUpdateQuestion={onUpdateQuestion}
              onUpdateReference={onUpdateReference}
              question={currentQuestion}
              questionIndex={currentQuestionIndex}
              questions={questions}
              totalQuestions={totalQuestions}
            />
          </div>
        </div>

        {/* Fixed Action Bar at Bottom */}
        <footer className="admin-modal-footer admin-question-action-bar">
          <div className="admin-question-action-bar-left">
            <button
              aria-label="Previous question"
              className="secondary-cta is-compact admin-question-prev-btn"
              disabled={isFirst || totalQuestions === 0}
              onClick={handlePrevious}
              type="button"
            >
              <AdminIcon name="arrowLeft" size={18} />
              <span className="admin-action-btn-text">Previous</span>
            </button>
          </div>

          <div className="admin-question-action-bar-center">
            <button
              className="secondary-cta is-compact"
              disabled={isSaving}
              onClick={handleSave}
              type="button"
            >
              <AdminIcon name="pencil" size={16} />
              <span>{isSaving ? 'Saving…' : 'Save'}</span>
            </button>
          </div>

          <div className="admin-question-action-bar-right">
            <button
              aria-label="Next question"
              className="primary-cta is-compact admin-question-next-btn"
              disabled={isLast}
              onClick={handleNext}
              type="button"
            >
              <span className="admin-action-btn-text">Next</span>
              <AdminIcon name="chevron" size={18} />
            </button>
          </div>
        </footer>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedPrompt ? (
        <div
          aria-label="Unsaved Changes Confirmation"
          aria-modal="true"
          className="admin-modal-overlay admin-unsaved-dialog-overlay"
          role="dialog"
        >
          <div className="admin-modal admin-modal-narrow">
            <div className="admin-modal-header">
              <AdminIcon name="fire" size={20} />
              <strong>Unsaved Changes</strong>
            </div>

            <div className="admin-modal-body">
              <p>You have unsaved changes in your questions.</p>
              <p className="user-dialog-note">
                Discarding will revert the questions to their previously saved state. Keep editing to save your work.
              </p>
            </div>

            <div className="admin-modal-footer">
              <button
                className="secondary-cta is-compact"
                onClick={handleDiscardChanges}
                type="button"
              >
                Discard Changes
              </button>
              <button
                className="primary-cta is-compact"
                onClick={() => setShowUnsavedPrompt(false)}
                type="button"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
