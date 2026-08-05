import { useEffect, useMemo, useState } from 'react';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import { USER_ROLES } from '../constants/auth';
import {
  MAX_DRAFTS_PER_ADMIN,
  QUIZZES_PER_PAGE,
  QUIZ_STATUSES,
} from '../constants/quizManagement';
import { useQuizManagementData } from '../hooks/useQuizManagementData';
import {
  publishQuiz,
  setQuizActiveState,
  softDeleteQuiz,
} from '../services/quizManagementService';
import {
  formatDateTime,
  formatQuizLevel,
  formatShortDate,
  getQuizDisplayTitle,
} from '../utils/formatters';
import { formatQuizStatusLabel } from '../utils/quizManagement';

function getStatusTone(status) {
  if (status === QUIZ_STATUSES.ACTIVE) return 'is-success';
  if (status === QUIZ_STATUSES.INACTIVE || status === QUIZ_STATUSES.EXPIRED) return 'is-danger';
  return 'is-warning';
}

function getEstimatedTimeLabel(quiz) {
  const seconds = Number(quiz.estimatedTime);

  if (seconds > 0) {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
  }

  return quiz.timeLimitLabel || quiz.time || '1 min';
}

function QuizManagementLoadingState() {
  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div className="admin-skeleton admin-skeleton-title" />
      </section>
      <section className="admin-quiz-management-list">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="admin-skeleton admin-skeleton-card" key={`quiz-skeleton-${index}`} />
        ))}
      </section>
    </div>
  );
}

function Pagination({ currentPage, onPageChange, totalItems, totalPages }) {
  if (totalPages <= 1) return null;

  const start = ((currentPage - 1) * QUIZZES_PER_PAGE) + 1;
  const end = Math.min(currentPage * QUIZZES_PER_PAGE, totalItems);

  return (
    <footer className="admin-management-pagination">
      <span>{`${start}-${end} of ${totalItems} quizzes`}</span>

      <div className="admin-management-pagination-actions">
        <button
          className="admin-icon-button is-small"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <AdminIcon name="chevron" size={16} />
        </button>

        <span className="admin-management-page-chip">{currentPage}</span>

        <button
          className="admin-icon-button is-small is-next"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          <AdminIcon name="chevron" size={16} />
        </button>
      </div>
    </footer>
  );
}

function DraftStrip({ drafts, onEdit }) {
  if (!drafts.length) return null;

  return (
    <section className="admin-panel admin-quiz-draft-panel">
      <header className="admin-panel-header">
        <div>
          <h2>My Drafts</h2>
          <p>Resume a saved draft exactly where you left it.</p>
        </div>
      </header>

      <div className="admin-quiz-draft-grid">
        {drafts.slice(0, MAX_DRAFTS_PER_ADMIN).map((draft) => (
          <button
            className="admin-quiz-draft-card"
            key={draft.id}
            onClick={() => onEdit(draft.id)}
            type="button"
          >
            <span className="admin-status-pill is-warning">Draft</span>
            <strong>{getQuizDisplayTitle(draft.title) || 'Untitled Draft'}</strong>
            <small>{draft.updatedAt ? `Updated ${formatDateTime(draft.updatedAt)}` : 'Recently saved'}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuizCard({
  busyAction,
  onAction,
  onEdit,
  quiz,
}) {
  const isBusy = Boolean(busyAction);
  const status = quiz.status || QUIZ_STATUSES.DRAFT;
  const canPublish = status !== QUIZ_STATUSES.ACTIVE;
  const canActivate = status !== QUIZ_STATUSES.ACTIVE;
  const canDeactivate = status === QUIZ_STATUSES.ACTIVE;

  const handleActionClick = (event, action) => {
    event.stopPropagation();
    onAction(quiz, action);
  };

  return (
    <article
      className="admin-quiz-management-card"
      onClick={() => onEdit(quiz.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit(quiz.id);
        }
      }}
    >
      <div className="admin-quiz-card-topline">
        <span className={`admin-status-pill ${getStatusTone(status)}`}>
          {formatQuizStatusLabel(status)}
        </span>
        <span>{quiz.category || 'Uncategorized'}</span>
      </div>

      <div className="admin-quiz-card-title">
        <h2>{getQuizDisplayTitle(quiz.title) || 'Untitled Quiz'}</h2>
        <p>{quiz.description || 'No description added yet.'}</p>
      </div>

      <dl className="admin-quiz-card-details">
        <div>
          <dt>Level</dt>
          <dd>{formatQuizLevel(quiz.level)}</dd>
        </div>
        <div>
          <dt>Questions</dt>
          <dd>{quiz.totalQuestions ?? quiz.questions?.length ?? 0}</dd>
        </div>
        <div>
          <dt>Estimated Time</dt>
          <dd>{getEstimatedTimeLabel(quiz)}</dd>
        </div>
        <div>
          <dt>Publish Date</dt>
          <dd>{quiz.publishAt ? formatShortDate(quiz.publishAt) : 'Not published'}</dd>
        </div>
        <div>
          <dt>Updated Date</dt>
          <dd>{formatShortDate(quiz.updatedAt || quiz.createdAt)}</dd>
        </div>
      </dl>

      <div className="admin-quiz-card-actions">
        {canPublish ? (
          <button
            className="primary-cta is-compact"
            disabled={isBusy}
            onClick={(event) => handleActionClick(event, 'publish')}
            aria-label={`Publish ${quiz.title || 'quiz'}`}
            type="button"
          >
            <AdminIcon name="bookPlus" size={16} />
            <span className="admin-action-label">{busyAction === 'publish' ? 'Publishing...' : 'Publish'}</span>
          </button>
        ) : null}

        {canActivate ? (
          <button
            className="secondary-cta is-compact"
            disabled={isBusy}
            onClick={(event) => handleActionClick(event, 'activate')}
            aria-label={`Activate ${quiz.title || 'quiz'}`}
            type="button"
          >
            <AdminIcon name="toggle" size={16} />
            <span className="admin-action-label">{busyAction === 'activate' ? 'Activating...' : 'Activate'}</span>
          </button>
        ) : null}

        {canDeactivate ? (
          <button
            className="secondary-cta is-compact"
            disabled={isBusy}
            onClick={(event) => handleActionClick(event, 'deactivate')}
            aria-label={`Deactivate ${quiz.title || 'quiz'}`}
            type="button"
          >
            <AdminIcon name="eyeOff" size={16} />
            <span className="admin-action-label">{busyAction === 'deactivate' ? 'Deactivating...' : 'Deactivate'}</span>
          </button>
        ) : null}

        <button
          className="ghost-cta is-compact"
          disabled={isBusy}
          onClick={(event) => handleActionClick(event, 'delete')}
          aria-label={`Move ${quiz.title || 'quiz'} to inactive`}
          type="button"
        >
          <AdminIcon name="trash" size={16} />
          <span className="admin-action-label">{busyAction === 'delete' ? 'Deleting...' : 'Delete'}</span>
        </button>
      </div>
    </article>
  );
}

export default function QuizManagementPage({
  onCreateQuiz,
  onEditQuiz,
  viewer,
}) {
  const { data, error, loading, retry } = useQuizManagementData(viewer);
  const [page, setPage] = useState(1);
  const [busyByQuizId, setBusyByQuizId] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const isQuizAdmin = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(viewer?.role);

  const totalPages = Math.max(1, Math.ceil(data.quizzes.length / QUIZZES_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const visibleQuizzes = useMemo(() => {
    const start = (page - 1) * QUIZZES_PER_PAGE;
    return data.quizzes.slice(start, start + QUIZZES_PER_PAGE);
  }, [data.quizzes, page]);

  const handleQuizAction = async (quiz, action) => {
    if (action === 'edit') {
      onEditQuiz(quiz.id);
      return;
    }

    setFeedback({ error: '', success: '' });
    setBusyByQuizId((currentState) => ({
      ...currentState,
      [quiz.id]: action,
    }));

    try {
      if (action === 'publish') {
        await publishQuiz({ quizId: quiz.id, viewer });
        setFeedback({ error: '', success: 'Quiz published, activated, and made visible to users.' });
      }

      if (action === 'activate') {
        await setQuizActiveState({ active: true, quizId: quiz.id, viewer });
        setFeedback({ error: '', success: 'Quiz activated for users.' });
      }

      if (action === 'deactivate') {
        await setQuizActiveState({ active: false, quizId: quiz.id, viewer });
        setFeedback({ error: '', success: 'Quiz deactivated. Existing attempts can still finish normally.' });
      }

      if (action === 'delete') {
        await softDeleteQuiz({ quizId: quiz.id, viewer });
        setFeedback({ error: '', success: 'Quiz moved to INACTIVE. Hard delete is disabled.' });
      }

      await retry();
    } catch (actionError) {
      setFeedback({
        error: actionError?.publicMessage || 'We could not update this quiz right now.',
        success: '',
      });
    } finally {
      setBusyByQuizId((currentState) => ({
        ...currentState,
        [quiz.id]: '',
      }));
    }
  };

  if (!isQuizAdmin) {
    return (
      <AppStatusView
        state={{
          message: 'Only Admin and Super Admin accounts can manage quizzes.',
          statusCode: 403,
          title: 'Quiz Management Access Required',
        }}
      />
    );
  }

  if (loading) {
    return <QuizManagementLoadingState />;
  }

  if (error) {
    return (
      <AppStatusView
        actions={[{ label: 'Try Again', onClick: retry }]}
        state={error}
      />
    );
  }

  return (
    <div className="admin-dashboard admin-quiz-management-page">
      <section className="admin-page-hero">
        <div className="admin-page-hero-copy">
          <span className="admin-badge">Quiz Management</span>
          <h1>Manage Concept Quizzes</h1>
          <p>Create, draft, publish, activate, and retire SoulSync quizzes without exposing Firestore IDs in public URLs.</p>
        </div>

        <div className="admin-page-hero-actions">
          <button className="primary-cta is-compact" onClick={onCreateQuiz} type="button">
            <AdminIcon name="bookPlus" size={18} />
            <span>Create Quiz</span>
          </button>
        </div>
      </section>

      {feedback.error ? (
        <div className="admin-profile-feedback-card is-error">{feedback.error}</div>
      ) : null}

      {feedback.success ? (
        <div className="admin-profile-feedback-card is-success">{feedback.success}</div>
      ) : null}

      <DraftStrip drafts={data.drafts} onEdit={onEditQuiz} />

      <section className="admin-panel admin-quiz-management-shell">
        <header className="admin-panel-header">
          <div>
            <h2>Quiz Listing</h2>
            <p>Showing {QUIZZES_PER_PAGE} quizzes per page. Users only see quizzes with ACTIVE status.</p>
          </div>
          <span className="admin-role-pill">{data.quizzes.length} Total</span>
        </header>

        {visibleQuizzes.length ? (
          <>
            <div className="admin-quiz-management-list">
              {visibleQuizzes.map((quiz) => (
                <QuizCard
                  busyAction={busyByQuizId[quiz.id]}
                  key={quiz.id}
                  onAction={handleQuizAction}
                  onEdit={onEditQuiz}
                  quiz={quiz}
                />
              ))}
            </div>

            <Pagination
              currentPage={page}
              onPageChange={setPage}
              totalItems={data.quizzes.length}
              totalPages={totalPages}
            />
          </>
        ) : (
          <div className="admin-empty-state">
            <p>No quizzes found yet. Create the first concept quiz to begin Phase 1.</p>
          </div>
        )}
      </section>
    </div>
  );
}
