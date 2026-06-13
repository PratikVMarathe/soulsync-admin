import { useEffect, useMemo, useState } from 'react';
import AdminIcon from '../components/AdminIcon';
import { updateCurrentAdminProfile } from '../services/adminProfileService';
import { sanitizePhoneInput } from '../utils/identity';
import { formatRoleLabel, formatShortDate, getInitials } from '../utils/formatters';

export default function AdminProfilePage({ onUserChange, viewer }) {
  const [formState, setFormState] = useState({
    name: '',
    phoneNumber: '',
  });
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormState({
      name: viewer?.profile?.name || viewer?.displayName || '',
      phoneNumber: viewer?.profile?.phoneNumber || '',
    });
  }, [viewer]);

  const profile = viewer?.profile || {};
  const initials = getInitials(viewer?.displayName || viewer?.email);
  const canEditPhone = !profile.phoneNumber;
  const memberSince = useMemo(() => formatShortDate(profile.createdAt), [profile.createdAt]);
  const emailAddress = profile.email || viewer?.email || 'Not available';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: name === 'phoneNumber' ? sanitizePhoneInput(value) : value,
    }));
    setFeedback({ error: '', success: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback({ error: '', success: '' });

    try {
      const nextViewer = await updateCurrentAdminProfile(formState);
      onUserChange?.(nextViewer);
      setFormState({
        name: nextViewer.profile?.name || nextViewer.displayName || '',
        phoneNumber: nextViewer.profile?.phoneNumber || '',
      });
      setFeedback({
        error: '',
        success: 'Your admin profile has been updated in SoulSync.',
      });
    } catch (error) {
      console.error('Failed to update admin profile:', error);
      setFeedback({
        error: error?.publicMessage || 'We could not save your admin profile right now. Please try again.',
        success: '',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-dashboard admin-profile-page">
      <section className="admin-profile-hero">
        <div className="admin-profile-identity-card">
          <div className="admin-profile-avatar">{initials}</div>

          <div className="admin-profile-identity-copy">
            <span className="admin-profile-eyebrow">Your Profile</span>
            <h1>{viewer?.displayName || 'Admin User'}</h1>
            <p>
              Keep your SoulSync details current so your admin access and platform workflow stay
              in sync.
            </p>

            <div className="admin-profile-badge-row">
              <span className="admin-profile-badge">
                <AdminIcon name="profile" size={16} />
                {formatRoleLabel(viewer?.role)}
              </span>
              <span className="admin-profile-badge is-soft">
                <AdminIcon name="lotus" size={16} />
                {viewer?.status || 'ACTIVE'}
              </span>
            </div>
          </div>
        </div>

        <div className="admin-profile-summary-grid">
          <article className="admin-profile-summary-card">
            <span>Member Since</span>
            <strong>{memberSince}</strong>
          </article>

          <article className="admin-profile-summary-card">
            <span>Sign-In Provider</span>
            <strong>Google</strong>
          </article>
        </div>
      </section>

      <section className="admin-panel admin-profile-form-shell">
        <header className="admin-profile-section-heading">
          <div>
            <h2>Personal Details</h2>
            <p>
              You can update your name anytime. Phone can only be added once, and then it becomes
              read-only.
            </p>
          </div>
        </header>

        {feedback.error ? (
          <div className="admin-profile-feedback-card is-error">
            {feedback.error}
          </div>
        ) : null}

        {feedback.success ? (
          <div className="admin-profile-feedback-card is-success">
            {feedback.success}
          </div>
        ) : null}

        <form className="admin-profile-form-grid" onSubmit={handleSubmit}>
          <label className="admin-profile-field">
            <span>Full Name</span>
            <input
              name="name"
              onChange={handleChange}
              placeholder="Enter your full name"
              type="text"
              value={formState.name}
            />
            <small>This name appears across your SoulSync admin workspace.</small>
          </label>

          <label className="admin-profile-field">
            <span>Phone Number</span>
            <input
              disabled={!canEditPhone}
              inputMode="numeric"
              maxLength={10}
              name="phoneNumber"
              onChange={handleChange}
              placeholder="Add phone number"
              type="tel"
              value={formState.phoneNumber}
            />
            <small>
              {canEditPhone
                ? 'You can add a phone number once. After that it becomes read-only.'
                : 'Phone number is locked after it is set.'}
            </small>
          </label>

          <div className="admin-profile-readonly-grid">
            <article className="admin-profile-readonly-card">
              <span>Email Address</span>
              <strong>{emailAddress}</strong>
            </article>
            {/* <article className="admin-profile-readonly-card">
              <span>Role</span>
              <strong>{formatRoleLabel(viewer?.role)}</strong>
            </article>
            <article className="admin-profile-readonly-card">
              <span>Status</span>
              <strong>{viewer?.status || 'ACTIVE'}</strong>
            </article> */}
          </div>

          <div className="admin-profile-form-actions">
            <button className="primary-cta" disabled={isSaving} type="submit">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
