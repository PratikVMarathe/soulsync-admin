import { useCallback, useState } from 'react';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import BlockUserDialog from '../components/BlockUserDialog';
import UnblockUserDialog from '../components/UnblockUserDialog';
import UserCardList from '../components/UserCardList';
import UserPagination from '../components/UserPagination';
import UserSearchBar from '../components/UserSearchBar';
import UserStatusFilter from '../components/UserStatusFilter';
import UserTable from '../components/UserTable';
import { useUsers } from '../hooks/useUsers';
import { useUserManagementActions } from '../hooks/useUserManagementActions';
import { formatRoleLabel } from '../utils/formatters';

export default function UserManagementPage({ onViewUser, viewer }) {
  const [status, setStatus] = useState('ALL');
  const [searchField, setSearchField] = useState('name');
  const [searchTerm, setSearchTerm] = useState('');
  const [blockTarget, setBlockTarget] = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);

  const {
    users,
    hasMore,
    hasPrev,
    loading,
    error,
    pageIndex,
    retry,
    nextPage,
    prevPage,
  } = useUsers({ status, searchField, searchTerm }, viewer);

  const handleActionSuccess = useCallback((action) => {
    retry();
  }, [retry]);

  const actions = useUserManagementActions(viewer, { onSuccess: handleActionSuccess });

  const handleSearch = ({ searchField: nextField, searchTerm: nextTerm }) => {
    setSearchField(nextField);
    setSearchTerm(nextTerm);
  };

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
  };

  const handleBlockConfirm = async () => {
    if (!blockTarget) return;

    try {
      await actions.handleBlockUser({ uid: blockTarget.id });
    } finally {
      setBlockTarget(null);
    }
  };

  const handleUnblockConfirm = async () => {
    if (!unblockTarget) return;

    try {
      await actions.handleUnblockUser({ uid: unblockTarget.id });
    } finally {
      setUnblockTarget(null);
    }
  };

  if (error && !loading) {
    return (
      <AppStatusView
        actions={[{ label: 'Try Again', onClick: retry }]}
        state={error}
      />
    );
  }

  return (
    <div className="admin-dashboard user-management-page">
      {/* Page Hero */}
      <section className="admin-page-hero">
        <div className="admin-page-hero-copy">
          <span className="admin-badge">{formatRoleLabel(viewer.role)}</span>
          <h1>User Management</h1>
          <p>View, edit, block, and manage SoulSync user accounts.</p>
        </div>
      </section>

      {/* Controls */}
      <section className="user-management-shell">
        <div className="user-management-controls">
          <UserSearchBar onSearch={handleSearch} />
          <UserStatusFilter onChange={handleStatusChange} value={status} />
        </div>

        {loading ? (
          <div className="user-management-loading">
            <div className="admin-skeleton admin-skeleton-panel" />
            <div className="admin-skeleton admin-skeleton-panel" />
            <div className="admin-skeleton admin-skeleton-panel" />
          </div>
        ) : (
          <>
            {/* Count label */}
            {!loading && users.length > 0 ? (
              <div className="user-management-count">
                <AdminIcon name="users" size={16} />
                <span>{users.length} user{users.length !== 1 ? 's' : ''} on this page</span>
              </div>
            ) : null}

            {/* Desktop table (hidden on mobile) */}
            <div className="user-management-table-view">
              <UserTable
                onBlockUser={(user) => setBlockTarget(user)}
                onUnblockUser={(user) => setUnblockTarget(user)}
                onViewUser={onViewUser}
                users={users}
              />
            </div>

            {/* Mobile cards (hidden on desktop) */}
            <div className="user-management-card-view">
              <UserCardList
                onBlockUser={(user) => setBlockTarget(user)}
                onUnblockUser={(user) => setUnblockTarget(user)}
                onViewUser={onViewUser}
                users={users}
              />
            </div>

            {/* Pagination */}
            {(hasPrev || hasMore) ? (
              <UserPagination
                hasPrev={hasPrev}
                hasMore={hasMore}
                loading={loading}
                onNext={nextPage}
                onPrev={prevPage}
                pageIndex={pageIndex}
              />
            ) : null}
          </>
        )}
      </section>

      {/* Block Dialog */}
      {blockTarget ? (
        <BlockUserDialog
          isLoading={actions.isBlocking}
          onClose={() => setBlockTarget(null)}
          onConfirm={handleBlockConfirm}
          user={blockTarget}
        />
      ) : null}

      {/* Unblock Dialog */}
      {unblockTarget ? (
        <UnblockUserDialog
          isLoading={actions.isUnblocking}
          onClose={() => setUnblockTarget(null)}
          onConfirm={handleUnblockConfirm}
          user={unblockTarget}
        />
      ) : null}
    </div>
  );
}
