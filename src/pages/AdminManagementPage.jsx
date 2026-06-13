import { useMemo, useState } from 'react';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import { USER_ROLES } from '../constants/auth';
import { useAdminManagementData } from '../hooks/useAdminManagementData';
import { getDerivedInviteStatus, updateAdminInviteStatus } from '../services/adminInviteService';
import {
  formatDateTime,
  formatRoleLabel,
  formatShortDate,
  getInitials,
} from '../utils/formatters';

const ITEMS_PER_PAGE = 10;

const TAB_KEYS = {
  ADMIN_INVITES: 'admin-invites',
  CURRENT: 'current-admins',
};

function EmptyState({ message }) {
  return (
    <div className="admin-empty-state">
      <p>{message}</p>
    </div>
  );
}

function Pagination({ currentPage, label, onPageChange, totalItems, totalPages }) {
  if (totalPages <= 1) return null;

  const start = ((currentPage - 1) * ITEMS_PER_PAGE) + 1;
  const end = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <footer className="admin-management-pagination">
      <span>{`${start}-${end} of ${totalItems} ${label}`}</span>

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

function getPanelCopy(tabKey) {
  if (tabKey === TAB_KEYS.CURRENT) {
    return {
      message: 'Review current admin accounts and open the edit flow for identity updates.',
      title: 'Current admins',
    };
  }

  return {
    message: 'Manage all admin invitations including pending, accepted, expired, and cancelled invites.',
    title: 'Admin invites',
  };
}

function getInviteStatusTone(status) {
  if (status === 'ACCEPTED') return 'is-success';
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'is-danger';
  return 'is-warning';
}

export default function AdminManagementPage({
  onCreateInvite,
  onEditAdmin,
  viewer,
}) {
  const isSuperAdmin = viewer?.role === USER_ROLES.SUPER_ADMIN;
  const { data, error, loading, retry } = useAdminManagementData(viewer);
  const [activeTab, setActiveTab] = useState(TAB_KEYS.CURRENT);
  const [pageByTab, setPageByTab] = useState({
    [TAB_KEYS.ADMIN_INVITES]: 1,
    [TAB_KEYS.CURRENT]: 1,
  });
  const [actionState, setActionState] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  const admins = useMemo(() => (
    [...data.admins].sort((left, right) => {
      const leftTime = left.updatedAt?.seconds || left.createdAt?.seconds || 0;
      const rightTime = right.updatedAt?.seconds || right.createdAt?.seconds || 0;
      return rightTime - leftTime;
    })
  ), [data.admins]);

  const invites = useMemo(() => (
    [...data.invites]
      .map((invite) => ({
        ...invite,
        derivedStatus: invite.derivedStatus || getDerivedInviteStatus(invite),
      }))
      .sort((left, right) => {
        const leftTime = left.updatedAt?.seconds || left.createdAt?.seconds || 0;
        const rightTime = right.updatedAt?.seconds || right.createdAt?.seconds || 0;
        return rightTime - leftTime;
      })
  ), [data.invites]);

  const tabData = useMemo(() => {
    return [
      { key: TAB_KEYS.CURRENT, label: 'Current Admins', items: admins, type: 'admins' },
      { key: TAB_KEYS.ADMIN_INVITES, label: 'Admin Invites', items: invites, type: 'invites' },
    ];
  }, [admins, invites]);

  const activeTabConfig = tabData.find((tab) => tab.key === activeTab) || tabData[0];
  const currentPage = pageByTab[activeTab] || 1;
  const totalPages = Math.max(1, Math.ceil(activeTabConfig.items.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedItems = activeTabConfig.items.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const panelCopy = getPanelCopy(activeTab);

  const setPage = (tabKey, nextPage) => {
    setPageByTab((currentState) => ({
      ...currentState,
      [tabKey]: nextPage,
    }));
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setFeedback({ error: '', success: '' });
    setPage(tabKey, 1);
  };

  const handleInviteAction = async (inviteId, nextAction) => {
    setActionState((currentState) => ({
      ...currentState,
      [inviteId]: nextAction,
    }));
    setFeedback({ error: '', success: '' });

    try {
      await updateAdminInviteStatus({
        action: nextAction,
        inviteId,
        viewer,
      });
      await retry();
      setFeedback({
        error: '',
        success: nextAction === 'cancel'
          ? 'Invite cancelled and identity locks were released.'
          : 'Invite was resent and identity locks were reserved again.',
      });
    } catch (inviteError) {
      setFeedback({
        error: inviteError?.publicMessage || 'We could not update this invite right now.',
        success: '',
      });
    } finally {
      setActionState((currentState) => ({
        ...currentState,
        [inviteId]: '',
      }));
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <section className="admin-page-hero">
          <div className="admin-skeleton admin-skeleton-title" />
        </section>

        <section className="admin-panel admin-management-shell">
          <div className="admin-skeleton admin-skeleton-panel" />
        </section>
      </div>
    );
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
    <div className="admin-dashboard admin-management-page">
      <section className="admin-page-hero">
        <div className="admin-page-hero-copy">
          <span className="admin-badge">{formatRoleLabel(viewer.role)}</span>
          <h1>Admin Management</h1>
          <p>Review admins, pending invites, and admin invite history across SoulSync.</p>
        </div>

        {isSuperAdmin ? (
          <div className="admin-page-hero-actions">
            <button className="primary-cta is-compact" onClick={onCreateInvite} type="button">
              <AdminIcon name="userPlus" size={18} />
              <span>Create Admin</span>
            </button>
          </div>
        ) : null}
      </section>

      <section className="admin-management-shell">
        <div className="admin-management-tabs" role="tablist" aria-label="Admin management sections">
          {tabData.map((tab, index) => {
            const isActive = tab.key === activeTab;
            const nextTab = tabData[index + 1];
            const showSeparator = !isActive && nextTab && nextTab.key !== activeTab;

            return (
              <div className="admin-management-tab-wrap" key={tab.key}>
                <button
                  aria-selected={isActive}
                  className={`admin-management-tab${isActive ? ' is-active' : ''}`}
                  onClick={() => handleTabChange(tab.key)}
                  role="tab"
                  type="button"
                >
                  <span>{tab.label}</span>
                  <span className="admin-management-tab-count">{tab.items.length}</span>
                </button>

                {showSeparator ? <span className="admin-management-tab-separator">|</span> : null}
              </div>
            );
          })}
        </div>

        <div className="admin-management-panel">
          <div className="admin-management-panel-note">
            <span className="admin-management-panel-icon">
              <AdminIcon name={activeTab === TAB_KEYS.CURRENT ? 'shield' : 'book'} size={20} />
            </span>

            <div>
              <strong>{panelCopy.title}</strong>
              <p>{panelCopy.message}</p>
            </div>
          </div>

          {feedback.error ? (
            <div className="admin-profile-feedback-card is-error">{feedback.error}</div>
          ) : null}

          {feedback.success ? (
            <div className="admin-profile-feedback-card is-success">{feedback.success}</div>
          ) : null}

          {activeTabConfig.type === 'admins' ? (
            pagedItems.length ? (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Admin</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Created By</th>
                        <th>Status</th>
                        {isSuperAdmin ? <th>Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedItems.map((admin) => (
                        <tr key={admin.id}>
                          <td data-label="Admin">
                            <div className="admin-table-item">
                              <span className="admin-avatar-dot">{getInitials(admin.name || admin.email)}</span>
                              <span>{admin.name || admin.email || admin.id}</span>
                            </div>
                          </td>
                          <td data-label="Role">
                            <span className="admin-role-pill">{formatRoleLabel(admin.role)}</span>
                          </td>
                          <td data-label="Email">{admin.email || 'Not set'}</td>
                          <td data-label="Phone">{admin.phoneNumber || 'Not set'}</td>
                          <td data-label="Created By">{admin.createdByName || 'System'}</td>
                          <td data-label="Status">
                            <span className={`admin-status-pill ${admin.status === 'BLOCKED' ? 'is-danger' : 'is-success'}`}>
                              {admin.status || 'ACTIVE'}
                            </span>
                          </td>
                          {isSuperAdmin ? (
                            <td data-label="Actions">
                              <div className="admin-row-actions">
                                <button
                                  className="secondary-cta is-compact"
                                  onClick={() => onEditAdmin(admin.id)}
                                  type="button"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={safePage}
                  label="admins"
                  onPageChange={(nextPage) => setPage(activeTab, nextPage)}
                  totalItems={activeTabConfig.items.length}
                  totalPages={totalPages}
                />
              </>
            ) : (
              <EmptyState message="No admin profiles are available in this section yet." />
            )
          ) : pagedItems.length ? (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Invitee</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Invited By</th>
                      <th>Created</th>
                      <th>Expires</th>
                      <th>Status</th>
                      {isSuperAdmin && activeTab === TAB_KEYS.ADMIN_INVITES ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItems.map((invite) => {
                      const inviteStatus = invite.derivedStatus || getDerivedInviteStatus(invite);
                      const isBusy = Boolean(actionState[invite.id]);
                      const inviteeName = invite.name || invite.emailLower || invite.email || invite.id;
                      const canCancelInvite = isSuperAdmin && inviteStatus === 'PENDING';
                      const canResendInvite = isSuperAdmin
                        && (inviteStatus === 'EXPIRED' || inviteStatus === 'CANCELLED');
                      const showActionsCell = isSuperAdmin && activeTab === TAB_KEYS.ADMIN_INVITES;

                      return (
                        <tr key={invite.id}>
                          <td data-label="Invitee">
                            <div className="admin-table-item">
                              <span className="admin-avatar-dot">{getInitials(inviteeName)}</span>
                              <span>{inviteeName}</span>
                            </div>
                          </td>
                          <td data-label="Email">{invite.emailLower || invite.email || 'Not set'}</td>
                          <td data-label="Phone">{invite.phoneNumber || 'Not set'}</td>
                          <td data-label="Invited By">{invite.invitedByName || invite.invitedBy || 'System'}</td>
                          <td data-label="Created">{formatDateTime(invite.createdAt)}</td>
                          <td data-label="Expires">{invite.expiresAt ? formatShortDate(invite.expiresAt) : 'Not set'}</td>
                          <td data-label="Status">
                            <span className={`admin-status-pill ${getInviteStatusTone(inviteStatus)}`}>
                              {inviteStatus}
                            </span>
                          </td>
                          {showActionsCell ? (
                            <td data-label="Actions">
                              <div className="admin-row-actions">
                                {canCancelInvite ? (
                                  <button
                                    className="secondary-cta is-compact"
                                    disabled={isBusy}
                                    onClick={() => handleInviteAction(invite.id, 'cancel')}
                                    type="button"
                                  >
                                    {isBusy ? 'Updating...' : 'Cancel'}
                                  </button>
                                ) : null}

                                {canResendInvite ? (
                                  <button
                                    className="primary-cta is-compact"
                                    disabled={isBusy}
                                    onClick={() => handleInviteAction(invite.id, 'resend')}
                                    type="button"
                                  >
                                    {isBusy ? 'Updating...' : 'Resend'}
                                  </button>
                                ) : null}

                                {!canCancelInvite && !canResendInvite ? (
                                  <span className="admin-row-actions-empty">No actions</span>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={safePage}
                label="records"
                onPageChange={(nextPage) => setPage(activeTab, nextPage)}
                totalItems={activeTabConfig.items.length}
                totalPages={totalPages}
              />
            </>
          ) : (
            <EmptyState message="No invite records are available in this tab yet." />
          )}
        </div>
      </section>
    </div>
  );
}
