import { formatDateTime } from '../utils/formatters';

function StatItem({ label, value }) {
  return (
    <div className="user-quiz-stat">
      <span className="user-quiz-stat-value">{value ?? '—'}</span>
      <span className="user-quiz-stat-label">{label}</span>
    </div>
  );
}

/**
 * Read-only quiz attempt summary panel.
 * Data is queried separately — not duplicated into the users document.
 */
export default function UserQuizSummary({ summary, loading }) {
  if (loading) {
    return (
      <div className="user-quiz-summary">
        <div className="admin-skeleton admin-skeleton-panel" style={{ height: '80px' }} />
      </div>
    );
  }

  if (!summary) return null;

  const bestDisplay = summary.bestScore !== null ? `${summary.bestScore}%` : null;
  const latestDisplay = summary.latestScore !== null ? `${summary.latestScore}%` : null;
  const lastDisplay = summary.lastAttemptAt ? formatDateTime(summary.lastAttemptAt) : null;

  return (
    <div className="user-quiz-summary">
      <div className="user-quiz-summary-header">
        <strong>Quiz Activity</strong>
        <span className="admin-badge">Read Only</span>
      </div>

      {summary.totalAttempts === 0 ? (
        <p className="user-quiz-empty">This user has not attempted any quizzes yet.</p>
      ) : (
        <div className="user-quiz-stats">
          <StatItem label="Total Attempts" value={summary.totalAttempts} />
          <StatItem label="Completed" value={summary.completedAttempts} />
          <StatItem label="Best Score" value={bestDisplay} />
          <StatItem label="Latest Score" value={latestDisplay} />
          <StatItem label="Last Attempt" value={lastDisplay} />
        </div>
      )}
    </div>
  );
}
