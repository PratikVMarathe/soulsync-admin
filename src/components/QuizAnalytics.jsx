import { useEffect, useMemo, useState } from 'react';
import { loadQuizAnalytics } from '../services/adminAnalyticsService';
import { formatShortDate, formatStatNumber } from '../utils/formatters';
import AdminIcon from './AdminIcon';

function formatTimeTaken(totalSeconds) {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return '0s';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function QuizAnalytics({ quiz, onBack }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);

  // Filters for Attempted Users List
  const [filter, setFilter] = useState('ALL');
  const [sort, setSort] = useState('LATEST');

  // Filters for User Attempt History
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historySort, setHistorySort] = useState('LATEST');

  useEffect(() => {
    async function fetchAnalytics() {
      if (!quiz?.slug && !quiz?.id) return;
      try {
        const data = await loadQuizAnalytics(quiz.slug || quiz.id);
        setAttempts(data);
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [quiz]);

  const stats = useMemo(() => {
    const totalAttempts = attempts.length;
    const uniqueUsers = new Set(attempts.map(a => a.userId).filter(Boolean)).size;
    const completedAttempts = attempts.filter(a => a.status === 'COMPLETED');
    const totalScore = completedAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
    const avgScore = completedAttempts.length ? Math.round(totalScore / completedAttempts.length) : 0;

    const completionRate = totalAttempts ? Math.round((completedAttempts.length / totalAttempts) * 100) : 0;

    const totalTime = completedAttempts.reduce((acc, curr) => acc + (curr.totalTimeTaken || 0), 0);
    const avgTime = completedAttempts.length ? Math.round(totalTime / completedAttempts.length) : 0;

    const passedAttempts = completedAttempts.filter(a => (a.percentage || 0) >= 70);
    const passRate = completedAttempts.length ? Math.round((passedAttempts.length / completedAttempts.length) * 100) : 0;

    return {
      totalAttempts,
      uniqueUsers,
      avgScore,
      completionRate,
      avgTime: formatTimeTaken(avgTime),
      passRate
    };
  }, [attempts]);

  const userStats = useMemo(() => {
    const map = new Map();
    attempts.forEach(attempt => {
      if (!attempt.userId) return;
      if (!map.has(attempt.userId)) {
        map.set(attempt.userId, {
          userId: attempt.userId,
          userName: attempt.userName,
          attempts: [],
          bestScore: 0,
          latestScore: 0,
          latestPercentage: 0,
          status: 'IN_PROGRESS',
          lastAttemptDate: null,
          lastAttemptMillis: 0
        });
      }

      const userStat = map.get(attempt.userId);
      userStat.attempts.push(attempt);

      const attemptMillis = attempt.startedAt?.toMillis ? attempt.startedAt.toMillis() : 0;

      if (attemptMillis >= userStat.lastAttemptMillis) {
        userStat.lastAttemptMillis = attemptMillis;
        userStat.lastAttemptDate = attempt.startedAt;
        userStat.status = attempt.status;
        if (attempt.status === 'COMPLETED') {
          userStat.latestScore = attempt.score || 0;
          userStat.latestPercentage = attempt.percentage || 0;
        }
      }

      if (attempt.status === 'COMPLETED' && (attempt.score || 0) > userStat.bestScore) {
        userStat.bestScore = attempt.score || 0;
      }
    });

    return Array.from(map.values());
  }, [attempts]);

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...userStats];

    if (filter === 'COMPLETED') result = result.filter(u => u.status === 'COMPLETED');
    if (filter === 'IN_PROGRESS') result = result.filter(u => u.status === 'IN_PROGRESS');
    if (filter === 'PASSED') result = result.filter(u => u.status === 'COMPLETED' && u.latestPercentage >= 70);
    if (filter === 'FAILED') result = result.filter(u => u.status === 'COMPLETED' && u.latestPercentage < 70);

    result.sort((a, b) => {
      if (sort === 'LATEST') return b.lastAttemptMillis - a.lastAttemptMillis;
      if (sort === 'OLDEST') return a.lastAttemptMillis - b.lastAttemptMillis;
      if (sort === 'HIGHEST_SCORE') return b.bestScore - a.bestScore;
      if (sort === 'LOWEST_SCORE') return a.bestScore - b.bestScore;
      // fastest doesn't make sense for users aggregated, fallback to latest
      return b.lastAttemptMillis - a.lastAttemptMillis;
    });

    return result;
  }, [userStats, filter, sort]);

  const userAttemptHistory = useMemo(() => {
    if (!selectedUser) return [];
    let result = [...selectedUser.attempts];

    if (historyFilter === 'COMPLETED') result = result.filter(a => a.status === 'COMPLETED');
    if (historyFilter === 'IN_PROGRESS') result = result.filter(a => a.status === 'IN_PROGRESS');
    if (historyFilter === 'PASSED') result = result.filter(a => a.status === 'COMPLETED' && (a.percentage || 0) >= 70);
    if (historyFilter === 'FAILED') result = result.filter(a => a.status === 'COMPLETED' && (a.percentage || 0) < 70);

    result.sort((a, b) => {
      const aTime = a.startedAt?.toMillis ? a.startedAt.toMillis() : 0;
      const bTime = b.startedAt?.toMillis ? b.startedAt.toMillis() : 0;

      if (historySort === 'LATEST') return bTime - aTime;
      if (historySort === 'OLDEST') return aTime - bTime;
      if (historySort === 'HIGHEST_SCORE') return (b.score || 0) - (a.score || 0);
      if (historySort === 'LOWEST_SCORE') return (a.score || 0) - (b.score || 0);
      if (historySort === 'FASTEST') return (a.totalTimeTaken || 999999) - (b.totalTimeTaken || 999999);

      return 0;
    });

    return result;
  }, [selectedUser, historyFilter, historySort]);

  if (loading) {
    return (
      <div className="admin-dashboard admin-quiz-management-page">
        <section className="admin-page-hero">
          <div className="admin-page-hero-copy">
            <h1>Loading Analytics...</h1>
          </div>
        </section>
      </div>
    );
  }

  if (selectedAttempt) {
    const details = (quiz.questions || []).map((question, index) => {
      const answer = selectedAttempt.answers?.[index];
      const correctIndex = Number(question.correctAnswer ?? question.correctIndex ?? question.answerIndex ?? 0);
      const isSkipped = answer?.selectedIndex === undefined || answer?.selectedIndex === null;
      const isCorrect = !isSkipped && answer.selectedIndex === correctIndex;
      const isWrong = !isSkipped && !isCorrect;

      let status = 'Skipped';
      let iconColor = '#9ca3af';
      if (isCorrect) {
        status = '✔ Correct';
        iconColor = '#10b981';
      } else if (isWrong) {
        status = '✖ Wrong';
        iconColor = '#ef4444';
      }

      return {
        questionText: question.text,
        status,
        iconColor,
        isCorrect,
        userAnswer: isSkipped ? null : (question.options[answer.selectedIndex]?.text || question.options[answer.selectedIndex]),
        correctAnswer: question.options[correctIndex]?.text || question.options[correctIndex],
        timeTaken: formatTimeTaken(answer?.timeTaken || 0),
        reference: question.reference?.[0] ? `${question.reference[0].source} ${question.reference[0].chapter}.${question.reference[0].verse}` : null,
      };
    });

    return (
      <div className="admin-dashboard admin-quiz-management-page">
        <section className="admin-page-hero">
          <div className="admin-page-hero-actions">

            <button className="secondary-cta is-compact" onClick={() => setSelectedAttempt(null)}>
              <AdminIcon name="arrowLeft" size={16} />
              <span>Back to History</span>
            </button>
          </div>
          <div className="admin-page-hero-copy">
            <span className="admin-badge">Attempt Details</span>
            <h1>{selectedUser.userName}'s Attempt</h1>
            <p>Score: {selectedAttempt.score} / {selectedAttempt.totalQuestions} • {selectedAttempt.percentage}%</p>
          </div>

        </section>

        <section className="admin-panel admin-analytics-panel">
          <div className="admin-analytics-details-list">
            {details.map((item, index) => (
              <div key={index} className="admin-analytics-detail-card">
                <div className="admin-analytics-detail-header">
                  <strong>Question {index + 1}</strong>
                  <span style={{ color: item.iconColor }}>{item.status}</span>
                </div>

                <p className="admin-analytics-detail-question">{item.questionText}</p>

                <div className="admin-analytics-detail-grid">
                  <div>
                    <span>User Answer</span>
                    <strong>{item.userAnswer || '-'}</strong>
                  </div>

                  {(!item.isCorrect) && (
                    <div>
                      <span>Correct Answer</span>
                      <strong>{item.correctAnswer}</strong>
                    </div>
                  )}

                  <div>
                    <span>Time Taken</span>
                    <strong>{item.timeTaken}</strong>
                  </div>

                  {item.reference && (
                    <div>
                      <span>Reference</span>
                      <strong>{item.reference}</strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (selectedUser) {
    return (
      <div className="admin-dashboard admin-quiz-management-page">
        <section className="admin-page-hero">
          <div className="admin-page-hero-copy">
            <span className="admin-badge">Attempt History</span>
            <h1>{selectedUser.userName}</h1>
            <p>Viewing all attempts for this user.</p>
          </div>
          <div className="admin-page-hero-actions">
            <button className="secondary-cta is-compact" onClick={() => setSelectedUser(null)}>
              <AdminIcon name="arrowLeft" size={16} />
              <span>Back to Users</span>
            </button>
          </div>
        </section>

        <section className="admin-panel admin-analytics-panel">
          <div className="admin-analytics-filters">
            <select className="admin-analytics-select" value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}>
              <option value="ALL">All Attempts</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PASSED">Passed</option>
              <option value="FAILED">Failed</option>
            </select>

            <select className="admin-analytics-select" value={historySort} onChange={e => setHistorySort(e.target.value)}>
              <option value="LATEST">Latest</option>
              <option value="HIGHEST_SCORE">Highest Score</option>
              <option value="LOWEST_SCORE">Lowest Score</option>
              <option value="FASTEST">Fastest</option>
              <option value="OLDEST">Oldest</option>
            </select>
          </div>

          <div className="admin-analytics-list">
            {userAttemptHistory.length === 0 ? (
              <p className="admin-analytics-empty">No attempts found.</p>
            ) : (
              userAttemptHistory.map((attempt) => {
                const chronologicalNumber = selectedUser.attempts.length - selectedUser.attempts.findIndex(a => a.id === attempt.id);
                return (
                  <div key={attempt.id} className="admin-analytics-list-item">
                    <div className="admin-analytics-item-info">
                      <strong>Attempt #{chronologicalNumber}</strong>
                      <span className="admin-analytics-item-meta">
                        <span>{attempt.status === 'COMPLETED' ? 'Completed' : 'In Progress'}</span>
                        <span>{formatShortDate(attempt.startedAt)}</span>
                        {attempt.status === 'COMPLETED' && (
                          <>
                            <span>{attempt.score} / {attempt.totalQuestions}</span>
                            <span>{attempt.percentage}%</span>
                            <span>{formatTimeTaken(attempt.totalTimeTaken)}</span>
                          </>
                        )}
                      </span>
                    </div>
                    {attempt.status === 'COMPLETED' && (
                      <button
                        className="admin-analytics-view-btn"
                        onClick={() => setSelectedAttempt(attempt)}
                      >
                        View Details
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-quiz-management-page">
      <section className="admin-page-hero">
        <div className="admin-page-hero-actions">
          <button className="secondary-cta is-compact" onClick={onBack}>
            <AdminIcon name="arrowLeft" size={16} />
            <span>Back to Quizzes</span>
          </button>
        </div>
        <div className="admin-page-hero-copy">
          <span className="admin-badge">Quiz Analytics</span>
          <h1>{quiz.title}</h1>
          <p>Overall performance and engagement metrics.</p>
        </div>
      </section>

      <div className="admin-analytics-stats-grid">
        <div className="admin-analytics-stat-card">
          <p>Total Attempts</p>
          <strong>{formatStatNumber(stats.totalAttempts)}</strong>
        </div>
        <div className="admin-analytics-stat-card">
          <p>Unique Users</p>
          <strong>{formatStatNumber(stats.uniqueUsers)}</strong>
        </div>
        <div className="admin-analytics-stat-card">
          <p>Average Score</p>
          <strong>{stats.avgScore}%</strong>
        </div>
        <div className="admin-analytics-stat-card">
          <p>Completion Rate</p>
          <strong>{stats.completionRate}%</strong>
        </div>
        <div className="admin-analytics-stat-card">
          <p>Average Time</p>
          <strong>{stats.avgTime}</strong>
        </div>
        <div className="admin-analytics-stat-card">
          <p>Pass Rate</p>
          <strong>{stats.passRate}%</strong>
        </div>
      </div>

      <section className="admin-panel admin-analytics-panel">
        <header className="admin-analytics-panel-header">
          <h2>Attempted Users</h2>
        </header>

        <div className="admin-analytics-filters">
          <select className="admin-analytics-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All Users</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </select>

          <select className="admin-analytics-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="LATEST">Latest</option>
            <option value="HIGHEST_SCORE">Highest Score</option>
            <option value="LOWEST_SCORE">Lowest Score</option>
            <option value="OLDEST">Oldest</option>
          </select>
        </div>

        <div className="admin-analytics-list">
          {filteredAndSortedUsers.length === 0 ? (
            <p className="admin-analytics-empty">No users found matching the filters.</p>
          ) : (
            filteredAndSortedUsers.map(userStat => (
              <div key={userStat.userId} className="admin-analytics-list-item">
                <div className="admin-analytics-item-info">
                  <strong>{userStat.userName}</strong>
                  <span className="admin-analytics-item-meta">
                    {userStat.status === 'COMPLETED' ? (
                      <>
                        <span>Latest: {userStat.latestScore} / {quiz.totalQuestions}</span>
                        <span>Best: {userStat.bestScore} / {quiz.totalQuestions}</span>
                      </>
                    ) : null}
                    <span>Attempts: {userStat.attempts.length}</span>
                    <span>{userStat.status === 'COMPLETED' ? 'Completed' : 'In Progress'}</span>
                    <span>{formatShortDate(userStat.lastAttemptDate)}</span>
                  </span>
                </div>
                <button
                  className="admin-analytics-view-btn"
                  onClick={() => setSelectedUser(userStat)}
                >
                  Attempt History
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
