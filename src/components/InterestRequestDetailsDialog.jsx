import { useEffect } from 'react';
import AdminIcon from './AdminIcon';

const LOCAL_CATEGORY_LABELS = {
  CLASS: 'Class',
  EVENT: 'Event',
  FESTIVAL: 'Festival',
};

function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function InterestRequestDetailsDialog({
  isOpen,
  isLoadingStatus = false,
  onClose,
  onEditOpportunity,
  onStatusChange,
  request,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !request) return null;

  const passionLabelMap = {
    STUDENT: 'Student',
    PROFESSIONAL: 'Professional',
    OTHER: 'Other',
  };

  const passionInstitutionMap = {
    STUDENT: 'College / Institution',
    PROFESSIONAL: 'Organization / Company',
    OTHER: 'Description / Profile',
  };

  return (
    <div
      aria-labelledby="interest-details-title"
      aria-modal="true"
      className="admin-dialog-backdrop"
      role="dialog"
    >
      <div className="admin-dialog-card admin-interest-details-card" style={{ maxWidth: '620px' }}>
        <header className="admin-dialog-header">
          <div>
            <h3 id="interest-details-title">User Interest Details</h3>
            <p>Form submission for {request.opportunityTitle || 'Satsang Central'}</p>
          </div>
          <button
            aria-label="Close dialog"
            className="ghost-cta is-compact admin-dialog-close"
            onClick={onClose}
            type="button"
          >
            <AdminIcon name="close" size={18} />
          </button>
        </header>

        <div className="admin-interest-details-body" style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Section: Opportunity Info & Status */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Opportunity</small>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{request.opportunityTitle || '—'}</strong>
              {request.category ? (
                <span className="admin-role-pill" style={{ display: 'inline-block', marginTop: '0.25rem' }}>
                  {LOCAL_CATEGORY_LABELS[request.category] || request.category}
                </span>
              ) : null}
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Status</small>
              {onStatusChange ? (
                <select
                  aria-label="Update interest status"
                  className="admin-mandala-status-select"
                  disabled={isLoadingStatus}
                  onChange={(e) => onStatusChange(request, e.target.value)}
                  style={{ marginTop: '0.25rem' }}
                  value={request.status || 'NEW'}
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="FOLLOW_UP">FOLLOW_UP</option>
                  <option value="CONNECTED">CONNECTED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              ) : (
                <span className="admin-role-pill" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                  {request.status || 'NEW'}
                </span>
              )}
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Submitted On</small>
              <span style={{ fontSize: '0.9rem', color: '#334155' }}>{formatDateTime(request.requestedAt)}</span>
            </div>
          </div>

          {/* Section: Personal & Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Full Name</small>
              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{request.name || '—'}</strong>
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Age</small>
              <span style={{ fontSize: '0.95rem', color: '#0f172a' }}>{request.age ? `${request.age} years` : '—'}</span>
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Email Address</small>
              {request.email ? (
                <a href={`mailto:${request.email}`} style={{ fontSize: '0.9rem', color: '#2563eb', textDecoration: 'none' }}>
                  {request.email}
                </a>
              ) : '—'}
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Phone Number</small>
              {request.phoneNumber ? (
                <a href={`tel:${request.phoneNumber}`} style={{ fontSize: '0.9rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                  {request.phoneNumber}
                </a>
              ) : '—'}
            </div>
          </div>

          {/* Section: Passion & Institution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Passion / Profile</small>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--soul-green-deep, #142e29)' }}>
                {passionLabelMap[request.passion] || request.passion || '—'}
              </span>
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                {passionInstitutionMap[request.passion] || 'College / Organization / Description'}
              </small>
              <span style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                {request.institutionName || '—'}
              </span>
            </div>
          </div>

          {/* Section: Learning Preferences */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Preferred Mode</small>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                {request.mode || '—'}
              </span>
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Preferred Language</small>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                {request.language || '—'}
              </span>
            </div>

            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Preferred Day</small>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                {request.preferredDay || '—'}
              </span>
            </div>
          </div>

          {/* Section: Notes / Description */}
          {request.description ? (
            <div>
              <small style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Notes / Questions</small>
              <p style={{ margin: 0, padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.9rem', color: '#334155', fontStyle: 'italic', borderLeft: '3px solid #cbd5e1' }}>
                &quot;{request.description}&quot;
              </p>
            </div>
          ) : null}
        </div>

        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div>
            {request.satsangCentralId && typeof onEditOpportunity === 'function' ? (
              <button
                className="secondary-cta is-compact"
                onClick={() => {
                  onClose();
                  onEditOpportunity(request.satsangCentralId);
                }}
                type="button"
              >
                Edit Opportunity
              </button>
            ) : null}
          </div>

          <button
            className="primary-cta is-compact"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
