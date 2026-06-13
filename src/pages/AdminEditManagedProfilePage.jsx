import { useEffect, useMemo, useState } from 'react';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import { USER_ROLES } from '../constants/auth';
import {
  AdminInviteError,
  loadManagedAdminProfile,
  updateManagedAdminProfile,
  verifyAdminIdentityFieldAvailability,
} from '../services/adminInviteService';
import { normalizeEmail, normalizePhoneNumber, sanitizePhoneInput } from '../utils/identity';
import { formatRoleLabel, formatShortDate, getInitials } from '../utils/formatters';

const EMPTY_FIELD_STATE = {
  email: { message: '', status: 'idle', verifiedValue: '' },
  phoneNumber: { message: '', status: 'idle', verifiedValue: '' },
};

function FieldVerificationState({ state }) {
  if (!state?.message) return null;

  return (
    <small className={`admin-form-feedback is-${state.status === 'verified' ? 'success' : state.status === 'checking' ? 'info' : 'error'}`}>
      {state.message}
    </small>
  );
}

export default function AdminEditManagedProfilePage({ adminId, onBack, viewer }) {
  const [profile, setProfile] = useState(null);
  const [formState, setFormState] = useState({
    email: '',
    name: '',
    phoneNumber: '',
  });
  const [fieldState, setFieldState] = useState(EMPTY_FIELD_STATE);
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const isSuperAdmin = viewer?.role === USER_ROLES.SUPER_ADMIN;
  const memberSince = useMemo(() => formatShortDate(profile?.createdAt), [profile?.createdAt]);
  const initials = getInitials(profile?.name || profile?.email || 'Admin');
  const currentEmail = profile?.emailLower || profile?.email || '';
  const currentPhone = profile?.phoneNumber || '';

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      setLoading(true);

      try {
        const nextProfile = await loadManagedAdminProfile({ adminId, viewer });
        if (!isMounted) return;

        setProfile(nextProfile);
        setFormState({
          email: nextProfile.email || '',
          name: nextProfile.name || '',
          phoneNumber: nextProfile.phoneNumber || '',
        });
        setFieldState({
          email: {
            message: 'Current email is ready.',
            status: 'verified',
            verifiedValue: nextProfile.emailLower || nextProfile.email || '',
          },
          phoneNumber: {
            message: 'Current phone number is ready.',
            status: 'verified',
            verifiedValue: nextProfile.phoneNumber || '',
          },
        });
        setLoadError(null);
      } catch (error) {
        if (!isMounted) return;

        setLoadError({
          message: error?.publicMessage || 'We could not load this admin profile right now.',
          statusCode: error?.code === 'admin-profile/not-found' ? 404 : 500,
          title: error?.code === 'admin-profile/not-found' ? 'Admin Not Found' : 'Could Not Load Admin',
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [adminId, isSuperAdmin, viewer]);

  const updateFieldState = (field, nextState) => {
    setFieldState((currentState) => ({
      ...currentState,
      [field]: {
        ...currentState[field],
        ...nextState,
      },
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'phoneNumber' ? sanitizePhoneInput(value) : value;

    setFormState((currentState) => ({
      ...currentState,
      [name]: nextValue,
    }));

    if (name === 'email') {
      updateFieldState('email', { message: '', status: 'idle', verifiedValue: '' });
    }

    if (name === 'phoneNumber') {
      updateFieldState('phoneNumber', { message: '', status: 'idle', verifiedValue: '' });
    }

    setFeedback({ error: '', success: '' });
  };

  const handleVerify = async (field) => {
    const value = field === 'email' ? formState.email : formState.phoneNumber;
    const normalizedValue = field === 'email' ? normalizeEmail(value) : normalizePhoneNumber(value);
    const currentValue = field === 'email' ? normalizeEmail(currentEmail) : normalizePhoneNumber(currentPhone);

    if (normalizedValue && normalizedValue === currentValue) {
      updateFieldState(field, {
        message: field === 'email' ? 'Current email is already valid.' : 'Current phone number is already valid.',
        status: 'verified',
        verifiedValue: normalizedValue,
      });
      return;
    }

    updateFieldState(field, {
      message: field === 'email' ? 'Checking email availability...' : 'Checking phone availability...',
      status: 'checking',
      verifiedValue: '',
    });

    try {
      const result = await verifyAdminIdentityFieldAvailability({
        excludeUserId: adminId,
        field,
        value,
        viewer,
      });

      updateFieldState(field, {
        message: result.successMessage,
        status: 'verified',
        verifiedValue: result.normalizedValue,
      });
    } catch (error) {
      updateFieldState(field, {
        message: error?.publicMessage || 'Verification failed. Please try again.',
        status: 'error',
        verifiedValue: '',
      });
    }
  };

  const emailReady = normalizeEmail(formState.email) === normalizeEmail(currentEmail)
    || (fieldState.email.status === 'verified' && fieldState.email.verifiedValue);
  const phoneReady = normalizePhoneNumber(formState.phoneNumber) === normalizePhoneNumber(currentPhone)
    || !formState.phoneNumber
    || (fieldState.phoneNumber.status === 'verified' && fieldState.phoneNumber.verifiedValue);
  const canSave = emailReady && phoneReady;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSave) {
      setFeedback({
        error: 'Verify both email and phone number before saving admin changes.',
        success: '',
      });
      return;
    }

    setSaving(true);
    setFeedback({ error: '', success: '' });

    try {
      const nextProfile = await updateManagedAdminProfile({
        adminId,
        email: formState.email,
        name: formState.name,
        phoneNumber: formState.phoneNumber,
        viewer,
      });

      setProfile(nextProfile);
      setFormState({
        email: nextProfile.email || '',
        name: nextProfile.name || '',
        phoneNumber: nextProfile.phoneNumber || '',
      });
      setFieldState({
        email: {
          message: 'Email verified and saved.',
          status: 'verified',
          verifiedValue: nextProfile.emailLower || nextProfile.email || '',
        },
        phoneNumber: {
          message: 'Phone number verified and saved.',
          status: 'verified',
          verifiedValue: nextProfile.phoneNumber || '',
        },
      });
      setFeedback({
        error: '',
        success: 'Admin details were updated and identity locks were refreshed.',
      });
    } catch (error) {
      const publicMessage = error instanceof AdminInviteError
        ? error.publicMessage
        : 'We could not save this admin profile right now. Please try again.';

      setFeedback({
        error: publicMessage,
        success: '',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AppStatusView
        actions={[{ label: 'Back to Admin Management', onClick: onBack }]}
        state={{
          message: 'Only the Super Admin can edit admin identities.',
          statusCode: 403,
          title: 'Super Admin Access Required',
        }}
      />
    );
  }

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

  if (loadError) {
    return (
      <AppStatusView
        actions={[{ label: 'Back to Admin Management', onClick: onBack }]}
        state={loadError}
      />
    );
  }

  return (
    <div className="admin-dashboard admin-profile-page">
      <section className="admin-profile-hero">
        <div className="admin-profile-identity-card">
          <div className="admin-profile-avatar">{initials}</div>

          <div className="admin-profile-identity-copy">
            <span className="admin-profile-eyebrow">Admin Management</span>
            <h1>{profile?.name || profile?.email || 'Admin User'}</h1>

            <div className="admin-profile-badge-row">
              <span className="admin-profile-badge">
                <AdminIcon name="profile" size={16} />
                {formatRoleLabel(profile?.role)}
              </span>
              <span className="admin-profile-badge is-soft">
                <AdminIcon name="lotus" size={16} />
                {profile?.status || 'ACTIVE'}
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
            <h2>Edit Admin Details</h2>
          </div>
        </header>

        {feedback.error ? (
          <div className="admin-profile-feedback-card is-error">{feedback.error}</div>
        ) : null}

        {feedback.success ? (
          <div className="admin-profile-feedback-card is-success">{feedback.success}</div>
        ) : null}

        <form className="admin-profile-form-grid admin-admin-form-grid" onSubmit={handleSubmit}>
          <label className="admin-profile-field">
            <span>Full Name</span>
            <input
              name="name"
              onChange={handleChange}
              placeholder="Enter full name"
              type="text"
              value={formState.name}
            />
            <small>This name appears across the admin workspace.</small>
          </label>

          <div className="admin-form-empty-slot" aria-hidden="true" />

          <label className="admin-profile-field">
            <span>Email Address</span>
            <div className="admin-inline-input-action">
              <input
                name="email"
                onChange={handleChange}
                placeholder="admin@example.com"
                type="email"
                value={formState.email}
              />
              <button
                className="secondary-cta is-compact"
                disabled={fieldState.email.status === 'checking'}
                onClick={() => handleVerify('email')}
                type="button"
              >
                {fieldState.email.status === 'checking' ? 'Checking...' : 'Verify Email'}
              </button>
            </div>
            <FieldVerificationState state={fieldState.email} />
          </label>

          <label className="admin-profile-field">
            <span>Phone Number</span>
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
                disabled={fieldState.phoneNumber.status === 'checking'}
                onClick={() => handleVerify('phoneNumber')}
                type="button"
              >
                {fieldState.phoneNumber.status === 'checking' ? 'Checking...' : 'Verify Phone'}
              </button>
            </div>
            <FieldVerificationState state={fieldState.phoneNumber} />
          </label>

          <div className="admin-profile-readonly-grid">
            <article className="admin-profile-readonly-card">
              <span>Role</span>
              <strong>{formatRoleLabel(profile?.role)}</strong>
            </article>

            <article className="admin-profile-readonly-card">
              <span>Status</span>
              <strong>{profile?.status || 'ACTIVE'}</strong>
            </article>

            <article className="admin-profile-readonly-card">
              <span>Created By</span>
              <strong>{profile?.createdByName || 'System'}</strong>
            </article>
          </div>

          <div className="admin-profile-form-actions">
            <button className="primary-cta" disabled={saving || !canSave} type="submit">
              {saving ? 'Saving...' : 'Save Admin Changes'}
            </button>
            <button className="secondary-cta is-compact" style={{ marginLeft: '1rem' }} onClick={onBack} type="button">
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
