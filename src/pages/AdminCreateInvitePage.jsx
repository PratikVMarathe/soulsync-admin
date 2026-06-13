import { useMemo, useState } from 'react';
import AppStatusView from '../components/AppStatusView';
import { USER_ROLES } from '../constants/auth';
import { createAdminInvite, AdminInviteError, verifyAdminInviteFieldAvailability } from '../services/adminInviteService';
import { sanitizePhoneInput } from '../utils/identity';

const DEFAULT_FIELD_STATE = {
  email: { message: '', status: 'idle', verifiedValue: '' },
  phoneNumber: { message: '', status: 'idle', verifiedValue: '' },
};

function FieldVerificationState({ fieldState }) {
  if (!fieldState?.message) return null;

  return (
    <small className={`admin-form-feedback is-${fieldState.status === 'verified' ? 'success' : fieldState.status === 'checking' ? 'info' : 'error'}`}>
      {fieldState.message}
    </small>
  );
}

export default function AdminCreateInvitePage({ onBack, viewer }) {
  const [formState, setFormState] = useState({
    email: '',
    name: '',
    phoneNumber: '',
  });
  const [fieldState, setFieldState] = useState(DEFAULT_FIELD_STATE);
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = viewer?.role === USER_ROLES.SUPER_ADMIN;
  const isReadyToSubmit = fieldState.email.status === 'verified'
    && fieldState.phoneNumber.status === 'verified'
    && fieldState.email.verifiedValue
    && fieldState.phoneNumber.verifiedValue;

  const normalizedFormState = useMemo(() => ({
    email: formState.email.trim().toLowerCase(),
    phoneNumber: formState.phoneNumber.trim(),
  }), [formState.email, formState.phoneNumber]);

  const updateFieldState = (field, nextState) => {
    setFieldState((currentState) => ({
      ...currentState,
      [field]: {
        ...currentState[field],
        ...nextState,
      },
    }));
  };

  const handleFieldChange = (event) => {
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

    setFeedback({ message: '', tone: '' });
  };

  const handleVerify = async (field) => {
    const value = field === 'email' ? normalizedFormState.email : normalizedFormState.phoneNumber;

    updateFieldState(field, {
      message: field === 'email' ? 'Checking email availability...' : 'Checking phone availability...',
      status: 'checking',
      verifiedValue: '',
    });

    try {
      const result = await verifyAdminInviteFieldAvailability({ field, value, viewer });

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isReadyToSubmit) {
      setFeedback({
        message: 'Verify both email and phone number before creating the invite.',
        tone: 'error',
      });
      return;
    }

    setSubmitting(true);
    setFeedback({ message: '', tone: '' });

    try {
      const result = await createAdminInvite({
        email: normalizedFormState.email,
        name: formState.name,
        phoneNumber: normalizedFormState.phoneNumber,
        viewer,
      });

      setFormState({
        email: '',
        name: '',
        phoneNumber: '',
      });
      setFieldState(DEFAULT_FIELD_STATE);
      setFeedback({
        message: `Admin invite created for ${result.emailLower}. The email and phone are now reserved for ADMIN access.`,
        tone: 'success',
      });
    } catch (error) {
      const publicMessage = error instanceof AdminInviteError
        ? error.publicMessage
        : 'We could not create the admin invite right now. Please try again.';

      setFeedback({
        message: publicMessage,
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AppStatusView
        actions={[{ label: 'Back to Dashboard', onClick: onBack }]}
        state={{
          message: 'Only the Super Admin can create admin invites.',
          statusCode: 403,
          title: 'Super Admin Access Required',
        }}
      />
    );
  }

  return (
    <div className="admin-profile-page">
      <section className="admin-profile-hero admin-admin-hero">
        <div className="admin-profile-identity-copy">
          <span className="admin-profile-eyebrow">Admin Management</span>
          <h1>Create Admin Invite</h1>
          <p>
            Reserve an email and phone number for a future admin. Once invited, that identity
            cannot register as a normal user.
          </p>
        </div>

        <div className="admin-page-hero-actions">
          <button className="secondary-cta is-compact" onClick={onBack} type="button">
            Back to Admins
          </button>
        </div>
      </section>

      <section className="admin-panel admin-profile-form-shell admin-admin-form-shell">
        <div className="admin-profile-section-heading">
          <h2>Invite Details</h2>
          <p>Verify the email and phone first, then lock both identities into an admin invite.</p>
        </div>

        {feedback.message ? (
          <div className={`admin-profile-feedback-card ${feedback.tone === 'success' ? 'is-success' : 'is-error'}`} role="status">
            {feedback.message}
          </div>
        ) : null}

        <form className="admin-profile-form-grid admin-admin-form-grid" onSubmit={handleSubmit}>
          <label className="admin-profile-field">
            <span>Full Name (Optional)</span>
            <input
              autoComplete="name"
              name="name"
              onChange={handleFieldChange}
              placeholder="Add a name hint for the invite"
              type="text"
              value={formState.name}
            />
            <small>This helps you recognize the invite before the admin signs in with Google.</small>
          </label>

          <div className="admin-form-empty-slot" aria-hidden="true" />

          <label className="admin-profile-field">
            <span>Email Address</span>
            <div className="admin-inline-input-action">
              <input
                autoComplete="email"
                name="email"
                onChange={handleFieldChange}
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
            <FieldVerificationState fieldState={fieldState.email} />
          </label>

          <label className="admin-profile-field">
            <span>Phone Number</span>
            <div className="admin-inline-input-action">
              <input
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                name="phoneNumber"
                onChange={handleFieldChange}
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
            <FieldVerificationState fieldState={fieldState.phoneNumber} />
          </label>

          <div className="admin-profile-form-actions">
            <button className="primary-cta" disabled={submitting || !isReadyToSubmit} type="submit">
              {submitting ? 'Creating Invite...' : 'Create Admin Invite'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
