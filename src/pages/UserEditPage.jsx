import { useEffect, useMemo, useState } from 'react';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import { useUserDetails } from '../hooks/useUserDetails';
import { useUserManagementActions } from '../hooks/useUserManagementActions';
import { formatRoleLabel, formatShortDate, getInitials } from '../utils/formatters';
import { sanitizePhoneInput, normalizePhoneNumber } from '../utils/identity';

export default function UserEditPage({ uid, onBack, viewer }) {
  const { user, loading, error, retry } = useUserDetails(uid, viewer);
  
  const [formState, setFormState] = useState({
    name: '',
    phoneNumber: '',
  });

  const actions = useUserManagementActions(viewer, {
    onSuccess: () => {
      retry();
    }
  });

  useEffect(() => {
    if (user) {
      setFormState({
        name: user.name || '',
        phoneNumber: user.phoneNumber || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === 'phoneNumber' ? sanitizePhoneInput(value) : value;
    setFormState((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleSaveName = async () => {
    if (!formState.name.trim()) return;
    await actions.handleUpdateName({ uid, name: formState.name });
  };

  const handleSavePhone = async () => {
    const digits = normalizePhoneNumber(formState.phoneNumber);
    await actions.handleUpdatePhone({ uid, phoneNumber: digits });
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <section className="admin-page-hero">
          <div className="admin-skeleton admin-skeleton-title" />
        </section>
        <section className="admin-panel admin-profile-form-shell">
          <div className="admin-skeleton admin-skeleton-panel" />
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <AppStatusView
        actions={[{ label: 'Back to Users', onClick: onBack }]}
        state={error}
      />
    );
  }

  if (!user) return null;

  const displayName = user.name || user.email || uid;
  const memberSince = formatShortDate(user.createdAt);
  const initials = getInitials(displayName);

  return (
    <div className="admin-dashboard admin-profile-page">
      <section className="admin-profile-hero">
        <div className="admin-profile-identity-card">
          <div className="admin-profile-avatar">{initials}</div>

          <div className="admin-profile-identity-copy">
            <span className="admin-profile-eyebrow">User Management</span>
            <h1>{displayName}</h1>

            <div className="admin-profile-badge-row">
              <span className="admin-profile-badge">
                <AdminIcon name="profile" size={16} />
                {formatRoleLabel(user.role)}
              </span>
              <span className="admin-profile-badge is-soft">
                <AdminIcon name="lotus" size={16} />
                {user.status || 'ACTIVE'}
              </span>
            </div>
          </div>
        </div>

        <div className="admin-profile-summary-grid">
          <article className="admin-profile-summary-card">
            <span>Member Since</span>
            <strong>{memberSince}</strong>
          </article>
        </div>
      </section>

      <section className="admin-panel admin-profile-form-shell admin-admin-form-shell">
        <header className="admin-profile-section-heading">
          <div>
            <h2>Edit User Details</h2>
          </div>
        </header>

        <form className="admin-profile-form-grid admin-admin-form-grid" onSubmit={(e) => e.preventDefault()}>
          <label className="admin-profile-field">
            <span>Full Name <span className="admin-required-indicator">*</span></span>
            <div className="admin-inline-input-action">
              <input
                name="name"
                onChange={handleChange}
                placeholder="Enter full name"
                type="text"
                value={formState.name}
              />
              <button
                className="secondary-cta is-compact"
                disabled={actions.isUpdatingName || formState.name === user.name}
                onClick={handleSaveName}
                type="button"
              >
                {actions.isUpdatingName ? 'Saving...' : 'Save Name'}
              </button>
            </div>
          </label>

          <label className="admin-profile-field">
            <span>Phone Number <span className="admin-required-indicator">*</span></span>
            <div className="admin-inline-input-action">
              <input
                inputMode="numeric"
                maxLength={10}
                name="phoneNumber"
                onChange={handleChange}
                placeholder="10 digit phone number"
                type="tel"
                value={formState.phoneNumber}
              />
              <button
                className="secondary-cta is-compact"
                disabled={actions.isUpdatingPhone || formState.phoneNumber === (user.phoneNumber || '')}
                onClick={handleSavePhone}
                type="button"
              >
                {actions.isUpdatingPhone ? 'Saving...' : 'Save Phone'}
              </button>
            </div>
            <small>Changing the phone number will update the identity lock.</small>
          </label>

          <div className="admin-profile-readonly-grid">
            <article className="admin-profile-readonly-card">
              <span>Email Address</span>
              <strong>{user.email || user.emailLower || '—'}</strong>
            </article>

            <article className="admin-profile-readonly-card">
              <span>Role</span>
              <strong>{formatRoleLabel(user.role)}</strong>
            </article>

            <article className="admin-profile-readonly-card">
              <span>Status</span>
              <strong>{user.status || 'ACTIVE'}</strong>
            </article>
          </div>

          <div className="admin-profile-form-actions">
            <button className="secondary-cta is-compact" onClick={onBack} type="button">
              Return to User Details
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
