import { useEffect, useRef, useState } from 'react';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import ImagePreviewDialog from '../components/ImagePreviewDialog';
import ImageUploadDialog from '../components/ImageUploadDialog';
import QuestionManagementDialog from '../components/QuestionManagementDialog';
import {
  DEFAULT_REFERENCE,
  MAX_DRAFTS_PER_ADMIN,
  QUESTION_OPTION_COUNT,
  QUIZ_LEVEL_OPTIONS,
  QUIZ_STATUSES,
} from '../constants/quizManagement';
import { UPLOAD_FOLDERS } from '../constants/upload';
import {
  getDraftLimitState,
  loadQuizForEditing,
  publishQuiz,
  saveQuizChanges,
  saveQuizDraft,
} from '../services/quizManagementService';
import { formatQuizLevel } from '../utils/formatters';
import {
  createEmptyQuestion,
  formatQuizStatusLabel,
  getQuestionTimeLimit,
  getRemainingQuestionTime,
  quizToFormState,
  slugifyQuizTitle,
} from '../utils/quizManagement';

function FieldError({ message }) {
  if (!message) return null;
  return <small className="admin-form-feedback is-error">{message}</small>;
}

function buildFieldErrors(error) {
  return error?.fieldErrors || {};
}

function getQuestionError(fieldErrors, index, key) {
  return fieldErrors[`question-${index}-${key}`];
}

export default function QuizEditorPage({
  onBack,
  onSaved,
  quizId,
  viewer,
}) {
  const isEditing = Boolean(quizId);
  const hasLoggedResume = useRef(false);
  const [formState, setFormState] = useState(() => quizToFormState());
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [submittingAction, setSubmittingAction] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [draftLimit, setDraftLimit] = useState({
    draftCount: 0,
    limit: MAX_DRAFTS_PER_ADMIN,
    reached: false,
  });
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadEditor = async () => {
      setLoading(true);
      setError(null);

      try {
        const [limitState, loadedQuiz] = await Promise.all([
          getDraftLimitState({ excludeQuizId: quizId, viewer }),
          isEditing
            ? loadQuizForEditing({
              quizId,
              recordResume: !hasLoggedResume.current,
              viewer,
            })
            : Promise.resolve(null),
        ]);

        if (!isMounted) return;

        if (loadedQuiz) {
          hasLoggedResume.current = true;
          setFormState(loadedQuiz.formState);
          setSlugTouched(true);
        }

        setDraftLimit(limitState);
      } catch (loadError) {
        if (!isMounted) return;
        setError({
          message: loadError?.publicMessage || 'We could not prepare this quiz editor right now.',
          statusCode: loadError?.code === 'quiz-management/forbidden' ? 403 : 500,
          title: loadError?.code === 'quiz-management/forbidden'
            ? 'Quiz Editor Access Blocked'
            : 'Could Not Load Quiz Editor',
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadEditor();

    return () => {
      isMounted = false;
    };
  }, [isEditing, quizId, viewer]);

  const updateFormField = (field, value) => {
    setFormState((currentState) => {
      const nextState = {
        ...currentState,
        [field]: value,
      };

      if (field === 'title' && !slugTouched) {
        nextState.slug = slugifyQuizTitle(value);
      }

      return nextState;
    });
    setFieldErrors((currentErrors) => ({ ...currentErrors, [field]: '' }));
    setFeedback({ error: '', success: '' });
  };

  const handleSlugChange = (value) => {
    setSlugTouched(true);
    updateFormField('slug', slugifyQuizTitle(value));
  };

  const updateQuestion = (questionIndex, nextQuestion) => {
    setFormState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question, index) => (
        index === questionIndex ? { ...question, ...nextQuestion } : question
      )),
    }));
    setFeedback({ error: '', success: '' });
  };

  const updateQuestionOption = (questionIndex, optionIndex, value) => {
    setFormState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) => (
            currentOptionIndex === optionIndex ? value : option
          )),
        };
      }),
    }));
    setFeedback({ error: '', success: '' });
  };

  const handleOpenAddQuestion = () => {
    if (formState.questions.length === 0) {
      const remainingTime = getRemainingQuestionTime(formState.questions, formState.estimatedTime);
      if (remainingTime <= 0) {
        setFeedback({
          error: 'No timer budget remains. Increase estimated time or reduce existing question timers first.',
          success: '',
        });
        return;
      }
      setFormState((currentState) => ({
        ...currentState,
        questions: [createEmptyQuestion(0, remainingTime)],
      }));
    }
    setIsQuestionDialogOpen(true);
  };

  const addQuestion = () => {
    const remainingTime = getRemainingQuestionTime(formState.questions, formState.estimatedTime);

    if (remainingTime <= 0) {
      setFeedback({
        error: 'No timer budget remains. Increase estimated time or reduce existing question timers first.',
        success: '',
      });
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      questions: [
        ...currentState.questions,
        createEmptyQuestion(currentState.questions.length, remainingTime),
      ],
    }));
    setFeedback({ error: '', success: '' });
  };

  const removeQuestion = (questionIndex) => {
    setFormState((currentState) => ({
      ...currentState,
      questions: currentState.questions.filter((_, index) => index !== questionIndex),
    }));
    setFeedback({ error: '', success: '' });
  };

  const updateReference = (questionIndex, referenceIndex, field, value) => {
    setFormState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          references: question.references.map((reference, currentReferenceIndex) => (
            currentReferenceIndex === referenceIndex
              ? { ...reference, [field]: value }
              : reference
          )),
        };
      }),
    }));
    setFeedback({ error: '', success: '' });
  };

  const addReference = (questionIndex) => {
    setFormState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question, index) => (
        index === questionIndex
          ? { ...question, references: [...question.references, { ...DEFAULT_REFERENCE }] }
          : question
      )),
    }));
  };

  const removeReference = (questionIndex, referenceIndex) => {
    setFormState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          references: question.references.filter((_, currentReferenceIndex) => (
            currentReferenceIndex !== referenceIndex
          )),
        };
      }),
    }));
  };

  const handleQuestionTimeChange = (questionIndex, value) => {
    const maxTime = getQuestionTimeLimit({
      estimatedTime: formState.estimatedTime,
      questionIndex,
      questions: formState.questions,
    });
    const nextTime = Math.min(Math.max(1, Number(value) || 1), maxTime);

    updateQuestion(questionIndex, { time: nextTime });
  };

  const handleSubmit = async (action) => {
    setSubmittingAction(action);
    setFieldErrors({});
    setFeedback({ error: '', success: '' });
    let shouldRefreshDraftLimit = true;

    try {
      if (action === 'draft') {
        const nextQuizId = await saveQuizDraft({ formState, quizId, viewer });
        setFeedback({ error: '', success: 'Draft saved successfully.' });
        setFormState((currentState) => ({
          ...currentState,
          status: QUIZ_STATUSES.DRAFT,
        }));
        shouldRefreshDraftLimit = Boolean(quizId);
        onSaved(nextQuizId, { stayOnPage: !quizId });
      }

      if (action === 'save') {
        await saveQuizChanges({ formState, quizId, viewer });
        setFeedback({ error: '', success: 'Quiz changes saved successfully.' });
        onSaved(quizId, { stayOnPage: true });
      }

      if (action === 'publish') {
        const nextQuizId = await publishQuiz({ formState, quizId, viewer });
        setFeedback({ error: '', success: 'Quiz published and activated for users.' });
        setFormState((currentState) => ({
          ...currentState,
          status: QUIZ_STATUSES.ACTIVE,
        }));
        shouldRefreshDraftLimit = Boolean(quizId);
        onSaved(nextQuizId, { stayOnPage: !quizId });
      }

      if (shouldRefreshDraftLimit) {
        const nextDraftLimit = await getDraftLimitState({ excludeQuizId: quizId, viewer });
        setDraftLimit(nextDraftLimit);
      }
    } catch (submitError) {
      setFieldErrors(buildFieldErrors(submitError));
      setFeedback({
        error: submitError?.publicMessage || 'We could not save this quiz right now.',
        success: '',
      });
    } finally {
      setSubmittingAction('');
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <section className="admin-page-hero">
          <div className="admin-skeleton admin-skeleton-title" />
        </section>
        <section className="admin-skeleton admin-skeleton-panel" />
      </div>
    );
  }

  if (error) {
    return (
      <AppStatusView
        actions={[{ label: 'Back to Quiz Management', onClick: onBack }]}
        state={error}
      />
    );
  }

  const draftLimitReached = draftLimit.reached && !isEditing;
  const remainingTime = getRemainingQuestionTime(formState.questions, formState.estimatedTime);
  const canSaveDraft = !isEditing || formState.status === QUIZ_STATUSES.DRAFT;

  return (
    <div className="admin-profile-page admin-quiz-editor-page">
      <section className="admin-profile-hero admin-admin-hero">
        <button
          aria-label="Back to Quiz Management"
          className="ghost-cta is-compact admin-back-link"
          onClick={onBack}
          type="button"
        >
          <AdminIcon name="arrowLeft" size={16} />
          <span>Back to Quiz Management</span>
        </button>
        <div className="admin-profile-identity-copy">
          <span className="admin-profile-eyebrow">Quiz Management</span>
          <h1>{isEditing ? 'Edit Quiz' : 'Create Quiz'}</h1>
          <p>
            Build a concept quiz with clean slug routing, scripture references, and timer-safe
            questions.
          </p>
        </div>
      </section>

      {feedback.error ? (
        <div className="admin-profile-feedback-card is-error">{feedback.error}</div>
      ) : null}

      {feedback.success ? (
        <div className="admin-profile-feedback-card is-success">{feedback.success}</div>
      ) : null}

      {draftLimitReached ? (
        <div className="admin-profile-feedback-card is-error">
          Maximum draft limit reached. Delete or complete an existing draft before creating another.
        </div>
      ) : null}

      <section className="admin-panel admin-profile-form-shell admin-quiz-editor-shell">
        <div className="admin-profile-section-heading">
          <h2>Quiz Details</h2>
          <p>Use seconds for estimated time and question timers.</p>
        </div>

        <div className="admin-profile-form-grid admin-quiz-form-grid">
          <label className="admin-profile-field">
            <span>Title <span className="admin-required-indicator">*</span></span>
            <input
              onChange={(event) => updateFormField('title', event.target.value)}
              placeholder="Concept 1: Focus"
              type="text"
              value={formState.title}
            />
            <FieldError message={fieldErrors.title} />
          </label>

          <label className="admin-profile-field">
            <span>Slug <span className="admin-required-indicator">*</span></span>
            <input
              onChange={(event) => handleSlugChange(event.target.value)}
              placeholder="focus"
              type="text"
              value={formState.slug}
            />
            <small>Public URL will be /quiz/{formState.slug || 'your-slug'}.</small>
            <FieldError message={fieldErrors.slug} />
          </label>

          <label className="admin-profile-field">
            <span>Category</span>
            <input
              onChange={(event) => updateFormField('category', event.target.value)}
              placeholder="focus"
              type="text"
              value={formState.category}
            />
            <FieldError message={fieldErrors.category} />
          </label>

          <label className="admin-profile-field">
            <span>Level</span>
            <select
              onChange={(event) => updateFormField('level', event.target.value)}
              value={formState.level}
            >
              {QUIZ_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>{formatQuizLevel(level)}</option>
              ))}
            </select>
          </label>

          <label className="admin-profile-field admin-quiz-field-wide">
            <span>Description</span>
            <textarea
              onChange={(event) => updateFormField('description', event.target.value)}
              placeholder="Learn to maintain clarity during stressful situations."
              rows={4}
              value={formState.description}
            />
            <FieldError message={fieldErrors.description} />
          </label>

          <label className="admin-profile-field">
            <span>Estimated Time (seconds)</span>
            <input
              min={1}
              onChange={(event) => updateFormField('estimatedTime', Number(event.target.value) || 1)}
              type="number"
              value={formState.estimatedTime}
            />
            <small>{remainingTime} seconds remaining for new questions.</small>
            <FieldError message={fieldErrors.estimatedTime} />
          </label>

          <label className="admin-profile-field">
            <span>Visual Key</span>
            <input
              onChange={(event) => updateFormField('visualKey', event.target.value)}
              placeholder="focus-lake"
              type="text"
              value={formState.visualKey}
            />
          </label>

          <div className="admin-profile-field admin-image-field-group">
            <span>Image URL</span>
            <div className="admin-image-input-row">
              <input
                onChange={(event) => updateFormField('imageUrl', event.target.value)}
                placeholder="https://..."
                type="url"
                value={formState.imageUrl}
              />
              <div className="admin-image-actions-row">
                <button
                  className="secondary-cta is-compact"
                  onClick={() => setIsUploadDialogOpen(true)}
                  type="button"
                >
                  <AdminIcon name="uploadCloud" size={16} />
                  <span>Upload Image</span>
                </button>
                <button
                  className="secondary-cta is-compact"
                  disabled={!formState.imageUrl}
                  onClick={() => setIsPreviewOpen(true)}
                  type="button"
                >
                  <AdminIcon name="eye" size={16} />
                  <span>Preview</span>
                </button>
              </div>
            </div>
            <FieldError message={fieldErrors.imageUrl} />
          </div>

          <label className="admin-profile-field">
            <span>Image Alt</span>
            <input
              onChange={(event) => updateFormField('imageAlt', event.target.value)}
              placeholder="Person meditating near a peaceful lake"
              type="text"
              value={formState.imageAlt}
            />
          </label>

          <label className="admin-profile-field">
            <span>Publish Date</span>
            <input
              onChange={(event) => updateFormField('publishAt', event.target.value)}
              type="datetime-local"
              value={formState.publishAt}
            />
          </label>

          <label className="admin-profile-field">
            <span>Expiry Date</span>
            <input
              onChange={(event) => updateFormField('expireAt', event.target.value)}
              type="datetime-local"
              value={formState.expireAt}
            />
            <FieldError message={fieldErrors.expireAt} />
          </label>

          <label className="admin-quiz-toggle">
            <input
              checked={formState.allowRetake}
              onChange={(event) => updateFormField('allowRetake', event.target.checked)}
              type="checkbox"
            />
            <span>Allow retake</span>
          </label>

          {isEditing ? (
            <div className="admin-quiz-current-status">
              <span>Status</span>
              <strong>{formatQuizStatusLabel(formState.status || QUIZ_STATUSES.DRAFT)}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel admin-quiz-editor-shell admin-quiz-questions-overview-shell">
        <div className="admin-quiz-questions-overview">
          {formState.questions.length === 0 ? (
            <>
              <div className="admin-quiz-questions-overview-copy">
                <h2>Questions</h2>
                <p>Add at least one complete question before publishing. Each question must have four options.</p>
              </div>

              <button
                className="primary-cta is-compact"
                onClick={handleOpenAddQuestion}
                type="button"
              >
                <AdminIcon name="bookPlus" size={18} />
                <span>Add Question</span>
              </button>
            </>
          ) : (
            <>
              <div className="admin-quiz-questions-overview-copy">
                <div className="admin-quiz-questions-count-group">
                  <h2>Questions</h2>
                  <span className="admin-badge admin-badge-highlight">
                    {formState.questions.length} Question{formState.questions.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p>Review, edit, and navigate questions in the Question Management Workspace.</p>
              </div>

              <button
                className="secondary-cta is-compact"
                onClick={() => setIsQuestionDialogOpen(true)}
                type="button"
              >
                <AdminIcon name="book" size={18} />
                <span>View Questions</span>
              </button>
            </>
          )}
        </div>

        <FieldError message={fieldErrors.questions} />
      </section>

      {/* Question Management Workspace Dialog */}
      <QuestionManagementDialog
        fieldErrors={fieldErrors}
        formState={formState}
        isOpen={isQuestionDialogOpen}
        onAddQuestion={addQuestion}
        onAddReference={addReference}
        onClose={() => setIsQuestionDialogOpen(false)}
        onRemoveQuestion={removeQuestion}
        onRemoveReference={removeReference}
        onSave={handleSubmit}
        onUpdateOption={updateQuestionOption}
        onUpdateQuestion={updateQuestion}
        onUpdateReference={updateReference}
        setFieldErrors={setFieldErrors}
        setFormState={setFormState}
      />

      {/* Image Preview Modal */}
      <ImagePreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Quiz Image Preview"
        url={formState.imageUrl}
      />

      {/* Image Upload Modal */}
      <ImageUploadDialog
        folder={UPLOAD_FOLDERS.QUIZ}
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onSuccess={(url) => updateFormField('imageUrl', url)}
        title="Upload Quiz Image"
        viewer={viewer}
      />

      <section className="admin-quiz-editor-actions">
        {canSaveDraft ? (
          <button
            className="secondary-cta"
            disabled={submittingAction === 'draft' || draftLimitReached}
            onClick={() => handleSubmit('draft')}
            type="button"
          >
            {submittingAction === 'draft' ? 'Saving Draft...' : 'Save Draft'}
          </button>
        ) : null}

        {isEditing ? (
          <button
            className="secondary-cta"
            disabled={Boolean(submittingAction)}
            onClick={() => handleSubmit('save')}
            type="button"
          >
            {submittingAction === 'save' ? 'Saving...' : 'Save Changes'}
          </button>
        ) : null}

        <button
          className="primary-cta"
          disabled={Boolean(submittingAction)}
          onClick={() => handleSubmit('publish')}
          type="button"
        >
          {submittingAction === 'publish' ? 'Publishing...' : 'Publish Quiz'}
        </button>
      </section>
    </div>
  );
}
