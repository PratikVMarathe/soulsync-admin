import AdminIcon from './AdminIcon';
import { QUESTION_OPTION_COUNT } from '../constants/quizManagement';
import { getQuestionTimeLimit } from '../utils/quizManagement';

function FieldError({ message }) {
  if (!message) return null;
  return <small className="admin-form-feedback is-error">{message}</small>;
}

function getQuestionError(fieldErrors = {}, index, key) {
  return fieldErrors[`question-${index}-${key}`];
}

export default function QuestionEditor({
  estimatedTime,
  fieldErrors = {},
  isEmpty = false,
  onAddQuestion,
  onAddReference,
  onRemoveQuestion,
  onRemoveReference,
  onUpdateOption,
  onUpdateQuestion,
  onUpdateReference,
  question,
  questionIndex = 0,
  questions = [],
  totalQuestions = 0,
}) {
  if (isEmpty || !question) {
    return (
      <div className="admin-question-editor-empty">
        <div className="admin-question-editor-empty-card">
          <div className="admin-question-editor-empty-icon">
            <AdminIcon name="bookPlus" size={36} />
          </div>
          <h3>No Questions in Quiz</h3>
          <p>Your quiz is empty. Click &apos;Add Question&apos; to start building your quiz.</p>
          <button
            className="primary-cta is-compact"
            onClick={onAddQuestion}
            type="button"
          >
            <AdminIcon name="bookPlus" size={18} />
            <span>Add Question</span>
          </button>
        </div>
      </div>
    );
  }

  const maxTime = getQuestionTimeLimit({
    estimatedTime,
    questionIndex,
    questions,
  });

  const handleTimeChange = (value) => {
    const nextTime = Math.min(Math.max(1, Number(value) || 1), maxTime);
    onUpdateQuestion?.(questionIndex, { time: nextTime });
  };

  return (
    <article className="admin-question-editor-card" aria-label={`Question ${questionIndex + 1} Editor`}>
      <header className="admin-quiz-question-header admin-question-editor-header">
        <div className="admin-question-editor-title-group">
          <span className="admin-badge">Question {questionIndex + 1} of {totalQuestions}</span>
          <p>Max timer budget for this question: <strong>{maxTime}s</strong></p>
        </div>

        <button
          className="ghost-cta is-compact admin-question-remove-btn"
          onClick={() => onRemoveQuestion?.(questionIndex)}
          title="Remove this question"
          type="button"
        >
          <AdminIcon name="trash" size={16} />
          <span>Remove Question</span>
        </button>
      </header>

      {/* Question Text */}
      <label className="admin-profile-field admin-quiz-field-wide">
        <span>Question Text <span className="admin-required-indicator">*</span></span>
        <textarea
          onChange={(event) => onUpdateQuestion?.(questionIndex, { text: event.target.value })}
          placeholder="How can one maintain focus during stressful situations?"
          rows={3}
          value={question.text || ''}
        />
        <FieldError message={getQuestionError(fieldErrors, questionIndex, 'text')} />
      </label>

      {/* Options Grid */}
      <div className="admin-quiz-options-grid">
        {Array.from({ length: QUESTION_OPTION_COUNT }).map((_, optionIndex) => (
          <label className="admin-profile-field" key={`${question.id || questionIndex}-option-${optionIndex}`}>
            <span>Option {optionIndex + 1} <span className="admin-required-indicator">*</span></span>
            <input
              onChange={(event) => onUpdateOption?.(questionIndex, optionIndex, event.target.value)}
              placeholder={`Option ${optionIndex + 1}`}
              type="text"
              value={question.options?.[optionIndex] || ''}
            />
          </label>
        ))}
      </div>
      <FieldError message={getQuestionError(fieldErrors, questionIndex, 'options')} />

      {/* Controls: Correct Answer and Timer */}
      <div className="admin-quiz-question-controls">
        <label className="admin-profile-field">
          <span>Correct Answer <span className="admin-required-indicator">*</span></span>
          <select
            onChange={(event) => onUpdateQuestion?.(questionIndex, { correctIndex: Number(event.target.value) })}
            value={question.correctIndex ?? 0}
          >
            {Array.from({ length: QUESTION_OPTION_COUNT }).map((_, optionIndex) => (
              <option key={`${question.id || questionIndex}-answer-${optionIndex}`} value={optionIndex}>
                Option {optionIndex + 1} {question.options?.[optionIndex] ? `(${question.options[optionIndex].slice(0, 24)}${question.options[optionIndex].length > 24 ? '…' : ''})` : ''}
              </option>
            ))}
          </select>
          <FieldError message={getQuestionError(fieldErrors, questionIndex, 'correctIndex')} />
        </label>

        <label className="admin-profile-field">
          <span>Timer (seconds) <span className="admin-required-indicator">*</span></span>
          <input
            max={maxTime}
            min={1}
            onChange={(event) => handleTimeChange(event.target.value)}
            type="number"
            value={question.time ?? 30}
          />
          <FieldError message={getQuestionError(fieldErrors, questionIndex, 'time')} />
        </label>
      </div>

      {/* Scripture References List */}
      <div className="admin-quiz-reference-list">
        <div className="admin-quiz-reference-heading">
          <div>
            <strong>Scripture References</strong>
            <p className="admin-form-hint">Add chapter, verse, and textual context for spiritual grounding.</p>
          </div>
          <button
            className="secondary-cta is-compact"
            onClick={() => onAddReference?.(questionIndex)}
            type="button"
          >
            <AdminIcon name="plus" size={16} />
            <span>Add Reference</span>
          </button>
        </div>

        {(question.references || []).map((reference, referenceIndex) => (
          <div
            className="admin-quiz-reference-grid"
            key={`${question.id || questionIndex}-reference-${referenceIndex}`}
          >
            <label className="admin-profile-field">
              <span>Source</span>
              <input
                onChange={(event) => onUpdateReference?.(questionIndex, referenceIndex, 'source', event.target.value)}
                placeholder="Bhagavad Gita"
                type="text"
                value={reference.source || ''}
              />
            </label>

            <label className="admin-profile-field">
              <span>Chapter</span>
              <input
                min={1}
                onChange={(event) => onUpdateReference?.(questionIndex, referenceIndex, 'chapter', event.target.value)}
                placeholder="6"
                type="number"
                value={reference.chapter ?? ''}
              />
            </label>

            <label className="admin-profile-field">
              <span>Verse</span>
              <input
                min={1}
                onChange={(event) => onUpdateReference?.(questionIndex, referenceIndex, 'verse', event.target.value)}
                placeholder="35"
                type="number"
                value={reference.verse ?? ''}
              />
            </label>

            <label className="admin-profile-field">
              <span>Reference Text</span>
              <input
                onChange={(event) => onUpdateReference?.(questionIndex, referenceIndex, 'text', event.target.value)}
                placeholder="The restless mind can be controlled by practice and detachment."
                type="text"
                value={reference.text || ''}
              />
            </label>

            {question.references.length > 1 ? (
              <button
                className="ghost-cta is-compact admin-quiz-reference-remove"
                onClick={() => onRemoveReference?.(questionIndex, referenceIndex)}
                title="Remove this reference"
                type="button"
              >
                <AdminIcon name="trash" size={16} />
                <span>Remove Reference</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}
