import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import BlockUserDialog from '../components/BlockUserDialog';
import UnblockUserDialog from '../components/UnblockUserDialog';
import UserQuizSummary from '../components/UserQuizSummary';
import UserStatusBadge from '../components/UserStatusBadge';
import { useUserDetails } from '../hooks/useUserDetails';
import { useUserManagementActions } from '../hooks/useUserManagementActions';
import { formatDateTime, formatShortDate, getInitials } from '../utils/formatters';

export default function UserDetailsPage({ uid, onBack, viewer }) {
  const navigate = useNavigate();
  const [showBlock, setShowBlock] = useState(false);
  const [showUnblock, setShowUnblock] = useState(false);

  const { user, quizSummary, loading, error, retry } = useUserDetails(uid, viewer);

  const actions = useUserManagementActions(viewer, {
    onSuccess: () => {
      retry();
    },
  });

  const handleBlockConfirm = async () => {
    try {
      await actions.handleBlockUser({ uid });
      setShowBlock(false);
    } catch {
      // error handled in hook via AppNoticeCenter
    }
  };

  const handleUnblockConfirm = async () => {
    try {
      await actions.handleUnblockUser({ uid });
      setShowUnblock(false);
    } catch {
      // error handled in hook via AppNoticeCenter
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <section className="admin-page-hero">
          <div className="admin-skeleton admin-skeleton-title" />
        </section>
        <section className="user-detail-panel">
          <div className="admin-skeleton admin-skeleton-panel" />
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <AppStatusView
        actions={[
          { label: 'Try Again', onClick: retry },
          { label: 'Back to Users', onClick: onBack },
        ]}
        state={error}
      />
    );
  }

  if (!user) return null;

  const displayName = user.name || user.email || uid;
  const isBlocked = user.status === 'BLOCKED';
  const isSoftDeleted = user.status === 'SOFT_DELETED';

  return (
    <div className="admin-dashboard">
      {/* Page Hero */}
      <section className="admin-page-hero">
        <div className="admin-page-hero-copy">
          <button
            className="ghost-cta is-compact user-back-btn"
            onClick={onBack}
            type="button"
          >
            <AdminIcon name="arrowLeft" size={18} />
            <span>Users</span>
          </button>
          <h1>{displayName}</h1>
          <UserStatusBadge status={user.status} />
        </div>

        <div className="admin-page-hero-actions">
          {!isSoftDeleted ? (
            <>
              <button
                className="secondary-cta is-compact"
                onClick={() => navigate(`/admin/users/${uid}/edit`)}
                type="button"
              >
                <AdminIcon name="pencil" size={16} />
                <span>Edit</span>
              </button>

              {isBlocked ? (
                <button
                  className="primary-cta is-compact"
                  onClick={() => setShowUnblock(true)}
                  type="button"
                >
                  <AdminIcon name="userPlus" size={16} />
                  <span>Unblock</span>
                </button>
              ) : (
                <button
                  className="ghost-cta is-compact is-danger-ghost"
                  onClick={() => setShowBlock(true)}
                  type="button"
                >
                  <AdminIcon name="userBlocked" size={16} />
                  <span>Block</span>
                </button>
              )}
            </>
          ) : null}
        </div>
      </section>

      {/* Profile Panel */}
      <section className="user-detail-panel">
        <div className="user-detail-card">
          <div className="user-detail-avatar-row">
            <span className="admin-avatar-dot user-detail-avatar">{getInitials(displayName)}</span>
            <div>
              <strong className="user-detail-display-name">{displayName}</strong>
              <span className="user-detail-role-pill admin-role-pill">User</span>
            </div>
          </div>

          <dl className="user-detail-fields">
            <div className="user-detail-field">
              <dt>Email</dt>
              <dd>{user.email || user.emailLower || '—'}</dd>
            </div>
            <div className="user-detail-field">
              <dt>Phone</dt>
              <dd>{user.phoneNumber || '—'}</dd>
            </div>
            <div className="user-detail-field">
              <dt>Status</dt>
              <dd><UserStatusBadge status={user.status} /></dd>
            </div>
            <div className="user-detail-field">
              <dt>UID</dt>
              <dd className="user-detail-uid">{user.uid || uid}</dd>
            </div>
            <div className="user-detail-field">
              <dt>Joined</dt>
              <dd>{formatShortDate(user.createdAt)}</dd>
            </div>
            <div className="user-detail-field">
              <dt>Last Updated</dt>
              <dd>{user.updatedAt ? formatDateTime(user.updatedAt) : '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Quiz Activity */}
        <UserQuizSummary summary={quizSummary} loading={false} />
      </section>


      {/* Block Dialog */}
      {showBlock ? (
        <BlockUserDialog
          isLoading={actions.isBlocking}
          onClose={() => setShowBlock(false)}
          onConfirm={handleBlockConfirm}
          user={user}
        />
      ) : null}

      {/* Unblock Dialog */}
      {showUnblock ? (
        <UnblockUserDialog
          isLoading={actions.isUnblocking}
          onClose={() => setShowUnblock(false)}
          onConfirm={handleUnblockConfirm}
          user={user}
        />
      ) : null}
    </div>
  );
}
