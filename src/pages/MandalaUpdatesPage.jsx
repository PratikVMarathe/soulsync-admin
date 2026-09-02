import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminIcon from '../components/AdminIcon';
import InterestRequestDetailsDialog from '../components/InterestRequestDetailsDialog';
import {
  deleteInterestRequest,
  deleteSatsangOpportunity,
  fetchInterestRequests,
  fetchSatsangOpportunities,
  toggleSatsangOpportunityStatus,
  updateInterestRequestStatus,
} from '../services/mandalaAdminService';
import { formatDateTime } from '../utils/formatters';

const ITEMS_PER_PAGE = 10;

const TAB_KEYS = {
  SATSANG: 'satsang-central',
  INTERESTED: 'interested-users',
};

const CATEGORY_LABELS = {
  CLASS: 'Class',
  EVENT: 'Event',
  FESTIVAL: 'Festival',
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

function getTabPanelCopy(tabKey) {
  if (tabKey === TAB_KEYS.SATSANG) {
    return {
      title: 'Satsang Central',
      message: 'Manage all spiritual opportunities including classes, events, and festivals visible to users.',
    };
  }

  return {
    title: 'Interested Users',
    message: 'Review and follow up on user interest submissions for Satsang Central opportunities.',
  };
}

export default function MandalaUpdatesPage({
  onCreateOpportunity,
  onEditOpportunity,
  viewer,
}) {
  const [activeTab, setActiveTab] = useState(TAB_KEYS.SATSANG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [satsangItems, setSatsangItems] = useState([]);
  const [interestItems, setInterestItems] = useState([]);

  const [satsangSearch, setSatsangSearch] = useState('');
  const [satsangCategoryFilter, setSatsangCategoryFilter] = useState('ALL');
  const [satsangStatusFilter, setSatsangStatusFilter] = useState('ALL');
  const [satsangPage, setSatsangPage] = useState(1);

  const [interestSearch, setInterestSearch] = useState('');
  const [interestStatusFilter, setInterestStatusFilter] = useState('ALL');
  const [interestPage, setInterestPage] = useState(1);
  const [viewingRequest, setViewingRequest] = useState(null);

  const [actionState, setActionState] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [opps, reqs] = await Promise.all([
        fetchSatsangOpportunities(viewer),
        fetchInterestRequests(viewer),
      ]);
      setSatsangItems(opps);
      setInterestItems(reqs);
    } catch (err) {
      console.error('Failed to load Mandala Updates data:', err);
      setLoadError(err.message || 'Failed to load data. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [viewer]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const filteredSatsangItems = useMemo(() => {
    return satsangItems.filter((item) => {
      const matchesCategory = satsangCategoryFilter === 'ALL' || item.category === satsangCategoryFilter;
      const matchesStatus = satsangStatusFilter === 'ALL' || item.status === satsangStatusFilter;
      const cleanSearch = satsangSearch.toLowerCase().trim();
      const matchesSearch = !cleanSearch
        || (item.title || '').toLowerCase().includes(cleanSearch)
        || (item.description || '').toLowerCase().includes(cleanSearch)
        || (item.location || '').toLowerCase().includes(cleanSearch);

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [satsangItems, satsangCategoryFilter, satsangStatusFilter, satsangSearch]);

  const totalSatsangPages = Math.max(1, Math.ceil(filteredSatsangItems.length / ITEMS_PER_PAGE));
  const safeSatsangPage = Math.min(satsangPage, totalSatsangPages);
  const pagedSatsangItems = filteredSatsangItems.slice(
    (safeSatsangPage - 1) * ITEMS_PER_PAGE,
    safeSatsangPage * ITEMS_PER_PAGE,
  );

  const filteredInterestItems = useMemo(() => {
    return interestItems.filter((item) => {
      const matchesStatus = interestStatusFilter === 'ALL' || item.status === interestStatusFilter;
      const cleanSearch = interestSearch.toLowerCase().trim();
      const matchesSearch = !cleanSearch
        || (item.name || '').toLowerCase().includes(cleanSearch)
        || (item.email || '').toLowerCase().includes(cleanSearch)
        || (item.phoneNumber || '').includes(cleanSearch)
        || (item.opportunityTitle || '').toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesSearch;
    });
  }, [interestItems, interestStatusFilter, interestSearch]);

  const totalInterestPages = Math.max(1, Math.ceil(filteredInterestItems.length / ITEMS_PER_PAGE));
  const safeInterestPage = Math.min(interestPage, totalInterestPages);
  const pagedInterestItems = filteredInterestItems.slice(
    (safeInterestPage - 1) * ITEMS_PER_PAGE,
    safeInterestPage * ITEMS_PER_PAGE,
  );

  const tabData = [
    { key: TAB_KEYS.SATSANG, label: 'Satsang Central', count: satsangItems.length },
    { key: TAB_KEYS.INTERESTED, label: 'Interested Users', count: interestItems.length },
  ];

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setFeedback({ error: '', success: '' });
  };

  const handleToggleOpportunityStatus = async (opp) => {
    setActionState((s) => ({ ...s, [opp.id]: 'toggle' }));
    setFeedback({ error: '', success: '' });
    try {
      await toggleSatsangOpportunityStatus(viewer, opp);
      const nextStatus = opp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      setFeedback({ error: '', success: `Status for "${opp.title}" changed to ${nextStatus}.` });
      await loadAllData();
    } catch (err) {
      console.error('Toggle status error:', err);
      setFeedback({ error: err.message || 'Failed to toggle status.', success: '' });
    } finally {
      setActionState((s) => ({ ...s, [opp.id]: '' }));
    }
  };

  const handleDeleteOpportunity = async (opp) => {
    if (!window.confirm(`Are you sure you want to delete "${opp.title}"?`)) return;

    setActionState((s) => ({ ...s, [opp.id]: 'delete' }));
    setFeedback({ error: '', success: '' });
    try {
      await deleteSatsangOpportunity(viewer, opp.id, opp.title);
      setFeedback({ error: '', success: `Deleted opportunity "${opp.title}".` });
      await loadAllData();
    } catch (err) {
      console.error('Delete opportunity error:', err);
      setFeedback({ error: err.message || 'Failed to delete opportunity.', success: '' });
    } finally {
      setActionState((s) => ({ ...s, [opp.id]: '' }));
    }
  };

  const handleUpdateInterestStatus = async (req, newStatus) => {
    setActionState((s) => ({ ...s, [req.id]: 'status' }));
    setFeedback({ error: '', success: '' });
    try {
      await updateInterestRequestStatus(viewer, req.id, newStatus, req);
      setFeedback({ error: '', success: `Updated status for ${req.name} to ${newStatus}.` });
      if (viewingRequest?.id === req.id) {
        setViewingRequest((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      await loadAllData();
    } catch (err) {
      console.error('Update request status error:', err);
      setFeedback({ error: err.message || 'Failed to update request status.', success: '' });
    } finally {
      setActionState((s) => ({ ...s, [req.id]: '' }));
    }
  };

  const handleDeleteInterestRequest = async (req) => {
    if (!window.confirm(`Are you sure you want to delete interest request from ${req.name}?`)) return;

    setActionState((s) => ({ ...s, [req.id]: 'delete' }));
    setFeedback({ error: '', success: '' });
    try {
      await deleteInterestRequest(viewer, req.id, req);
      setFeedback({ error: '', success: `Deleted interest request from ${req.name}.` });
      await loadAllData();
    } catch (err) {
      console.error('Delete request error:', err);
      setFeedback({ error: err.message || 'Failed to delete request.', success: '' });
    } finally {
      setActionState((s) => ({ ...s, [req.id]: '' }));
    }
  };

  const panelCopy = getTabPanelCopy(activeTab);

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

  return (
    <div className="admin-dashboard admin-management-page">
      {/* Page Hero */}
      <section className="admin-page-hero">
        <div className="admin-page-hero-copy">
          <span className="admin-badge">Mandala</span>
          <h1>Maṇḍala Updates</h1>
          <p>Manage Satsang Central opportunities and review user interest submissions.</p>
        </div>

        {activeTab === TAB_KEYS.SATSANG ? (
          <div className="admin-page-hero-actions">
            <button
              className="primary-cta is-compact"
              onClick={onCreateOpportunity}
              type="button"
            >
              <AdminIcon name="plus" size={18} />
              <span>Create Opportunity</span>
            </button>
          </div>
        ) : null}
      </section>

      {/* Load Error */}
      {loadError ? (
        <div className="admin-profile-feedback-card is-error">{loadError}</div>
      ) : null}

      {/* Management Shell */}
      <section className="admin-management-shell">
        {/* Tabs */}
        <div className="admin-management-tabs" aria-label="Mandala sections" role="tablist">
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
                  <span className="admin-management-tab-count">{tab.count}</span>
                </button>

                {showSeparator ? <span className="admin-management-tab-separator">|</span> : null}
              </div>
            );
          })}
        </div>

        {/* Panel */}
        <div className="admin-management-panel">
          {/* Panel Note */}
          <div className="admin-management-panel-note">
            <span className="admin-management-panel-icon">
              <AdminIcon
                name={activeTab === TAB_KEYS.SATSANG ? 'spark' : 'users'}
                size={20}
              />
            </span>

            <div>
              <strong>{panelCopy.title}</strong>
              <p>{panelCopy.message}</p>
            </div>
          </div>

          {/* Feedback */}
          {feedback.error ? (
            <div className="admin-profile-feedback-card is-error">{feedback.error}</div>
          ) : null}

          {feedback.success ? (
            <div className="admin-profile-feedback-card is-success">{feedback.success}</div>
          ) : null}

          {/* Satsang Tab Filters */}
          {activeTab === TAB_KEYS.SATSANG ? (
            <>
              <div className="admin-mandala-filters">
                <div className="admin-mandala-search">
                  <AdminIcon name="search" size={16} />
                  <input
                    onChange={(e) => { setSatsangSearch(e.target.value); setSatsangPage(1); }}
                    placeholder="Search by title, location, or description..."
                    type="text"
                    value={satsangSearch}
                  />
                  {satsangSearch ? (
                    <button
                      className="admin-mandala-search-clear"
                      onClick={() => setSatsangSearch('')}
                      type="button"
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <div className="admin-mandala-filter-selects">
                  <label className="admin-mandala-filter-label" htmlFor="mandala-category-filter">
                    Category
                    <select
                      id="mandala-category-filter"
                      onChange={(e) => { setSatsangCategoryFilter(e.target.value); setSatsangPage(1); }}
                      value={satsangCategoryFilter}
                    >
                      <option value="ALL">All Categories</option>
                      <option value="CLASS">Class</option>
                      <option value="EVENT">Event</option>
                      <option value="FESTIVAL">Festival</option>
                    </select>
                  </label>

                  <label className="admin-mandala-filter-label" htmlFor="mandala-status-filter">
                    Status
                    <select
                      id="mandala-status-filter"
                      onChange={(e) => { setSatsangStatusFilter(e.target.value); setSatsangPage(1); }}
                      value={satsangStatusFilter}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                </div>
              </div>

              {pagedSatsangItems.length === 0 ? (
                <EmptyState message="No Satsang opportunities found matching your filters." />
              ) : (
                <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Opportunity</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Location / Link</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedSatsangItems.map((opp) => (
                          <tr key={opp.id}>
                            <td data-label="Opportunity">
                              <div className="admin-table-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                                <strong>{opp.title}</strong>
                                {opp.description ? (
                                  <small style={{ color: 'var(--admin-text-soft)' }}>
                                    {opp.description.length > 72
                                      ? `${opp.description.slice(0, 72)}…`
                                      : opp.description}
                                  </small>
                                ) : null}
                              </div>
                            </td>
                            <td data-label="Category">
                              <span className="admin-role-pill">
                                {CATEGORY_LABELS[opp.category] || opp.category}
                              </span>
                            </td>
                            <td data-label="Status">
                              <span className={`admin-status-pill ${opp.status === 'ACTIVE' ? 'is-success' : 'is-danger'}`}>
                                {opp.status}
                              </span>
                            </td>
                            <td data-label="Location / Link">
                              {opp.location || opp.meetingLink ? (
                                <span style={{ color: 'var(--admin-text-soft)', fontSize: '0.9rem' }}>
                                  {opp.location || opp.meetingLink}
                                </span>
                              ) : (
                                <span className="admin-row-actions-empty">—</span>
                              )}
                            </td>
                            <td data-label="Actions">
                              <div className="admin-row-actions">
                                <button
                                  className="secondary-cta is-compact"
                                  disabled={Boolean(actionState[opp.id])}
                                  onClick={() => onEditOpportunity(opp.id)}
                                  type="button"
                                >
                                  Edit
                                </button>

                                <button
                                  className="ghost-cta is-compact"
                                  disabled={Boolean(actionState[opp.id])}
                                  onClick={() => handleToggleOpportunityStatus(opp)}
                                  title={opp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                  type="button"
                                >
                                  {actionState[opp.id] === 'toggle'
                                    ? '…'
                                    : opp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                </button>

                                <button
                                  className="ghost-cta is-compact"
                                  disabled={Boolean(actionState[opp.id])}
                                  onClick={() => handleDeleteOpportunity(opp)}
                                  title="Delete"
                                  type="button"
                                >
                                  {actionState[opp.id] === 'delete' ? '…' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={safeSatsangPage}
                    label="opportunities"
                    onPageChange={setSatsangPage}
                    totalItems={filteredSatsangItems.length}
                    totalPages={totalSatsangPages}
                  />
                </>
              )}
            </>
          ) : null}

          {/* Interested Users Tab */}
          {activeTab === TAB_KEYS.INTERESTED ? (
            <>
              <div className="admin-mandala-filters">
                <div className="admin-mandala-search">
                  <AdminIcon name="search" size={16} />
                  <input
                    onChange={(e) => { setInterestSearch(e.target.value); setInterestPage(1); }}
                    placeholder="Search by name, email, phone, or opportunity..."
                    type="text"
                    value={interestSearch}
                  />
                  {interestSearch ? (
                    <button
                      className="admin-mandala-search-clear"
                      onClick={() => setInterestSearch('')}
                      type="button"
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <div className="admin-mandala-filter-selects">
                  <label className="admin-mandala-filter-label" htmlFor="interest-status-filter">
                    Status
                    <select
                      id="interest-status-filter"
                      onChange={(e) => { setInterestStatusFilter(e.target.value); setInterestPage(1); }}
                      value={interestStatusFilter}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="NEW">NEW</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="FOLLOW_UP">FOLLOW_UP</option>
                      <option value="CONNECTED">CONNECTED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </label>
                </div>
              </div>

              {pagedInterestItems.length === 0 ? (
                <EmptyState message="No interest requests found matching your filters." />
              ) : (
                <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Contact</th>
                          <th>Opportunity</th>
                          <th>Requested</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedInterestItems.map((req) => (
                          <tr key={req.id}>
                            <td data-label="User">
                              <div className="admin-table-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                                <span><strong>{req.name}</strong>{req.age ? ` (${req.age} yrs)` : ''}</span>
                                {req.passion ? (
                                  <small style={{ color: 'var(--soul-green-deep, #142e29)', fontWeight: 600 }}>
                                    {req.passion}: {req.institutionName || '—'}
                                  </small>
                                ) : null}
                                {(req.mode || req.language || req.preferredDay) ? (
                                  <small style={{ color: 'var(--admin-text-soft)' }}>
                                    {[req.mode, req.language, req.preferredDay ? `Day: ${req.preferredDay}` : null].filter(Boolean).join(' • ')}
                                  </small>
                                ) : null}
                                {req.description ? (
                                  <small style={{ color: 'var(--admin-text-soft)', fontStyle: 'italic' }}>
                                    &quot;{req.description}&quot;
                                  </small>
                                ) : null}
                              </div>
                            </td>
                            <td data-label="Contact">
                              <div style={{ display: 'grid', gap: '0.1rem' }}>
                                <span style={{ fontSize: '0.9rem' }}>{req.email}</span>
                                <small style={{ color: 'var(--admin-text-soft)' }}>
                                  {req.phoneNumber || 'No phone'}
                                </small>
                              </div>
                            </td>
                            <td data-label="Opportunity">
                              <div style={{ display: 'grid', gap: '0.25rem' }}>
                                <span>{req.opportunityTitle || 'General Interest'}</span>
                                {req.category ? (
                                  <span className="admin-role-pill" style={{ width: 'fit-content' }}>
                                    {CATEGORY_LABELS[req.category] || req.category}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td data-label="Requested">
                              <span style={{ color: 'var(--admin-text-soft)', fontSize: '0.9rem' }}>
                                {formatDateTime(req.requestedAt)}
                              </span>
                            </td>
                            <td data-label="Status">
                              <select
                                className="admin-mandala-status-select"
                                disabled={actionState[req.id] === 'status'}
                                onChange={(e) => handleUpdateInterestStatus(req, e.target.value)}
                                value={req.status || 'NEW'}
                              >
                                <option value="NEW">NEW</option>
                                <option value="CONTACTED">CONTACTED</option>
                                <option value="FOLLOW_UP">FOLLOW_UP</option>
                                <option value="CONNECTED">CONNECTED</option>
                                <option value="CLOSED">CLOSED</option>
                              </select>
                            </td>
                            <td data-label="Actions">
                              <div className="admin-row-actions">
                                <button
                                  className="ghost-cta is-compact"
                                  onClick={() => setViewingRequest(req)}
                                  type="button"
                                >
                                  View
                                </button>
                                <button
                                  className="ghost-cta is-compact"
                                  disabled={Boolean(actionState[req.id])}
                                  onClick={() => handleDeleteInterestRequest(req)}
                                  type="button"
                                >
                                  {actionState[req.id] === 'delete' ? '…' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={safeInterestPage}
                    label="interest requests"
                    onPageChange={setInterestPage}
                    totalItems={filteredInterestItems.length}
                    totalPages={totalInterestPages}
                  />
                </>
              )}
            </>
          ) : null}
        </div>
      </section>

      {/* User Interest Details Modal */}
      <InterestRequestDetailsDialog
        isLoadingStatus={actionState[viewingRequest?.id] === 'status'}
        isOpen={Boolean(viewingRequest)}
        onClose={() => setViewingRequest(null)}
        onEditOpportunity={onEditOpportunity}
        onStatusChange={handleUpdateInterestStatus}
        request={viewingRequest}
      />
    </div>
  );
}
