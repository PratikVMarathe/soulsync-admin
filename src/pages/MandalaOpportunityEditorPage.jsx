import { useEffect, useState } from 'react';
import AdminIcon from '../components/AdminIcon';
import AppStatusView from '../components/AppStatusView';
import {
  SATSANG_CATEGORIES,
  SATSANG_STATUSES,
  createSatsangOpportunity,
  fetchSatsangOpportunities,
  updateSatsangOpportunity,
} from '../services/mandalaAdminService';

function FieldError({ message }) {
  if (!message) return null;
  return <small className="admin-form-feedback is-error">{message}</small>;
}

function formatTimestampForInput(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
}

export default function MandalaOpportunityEditorPage({
  onBack,
  onSaved,
  opportunityId = null,
  viewer,
}) {
  const isEditing = Boolean(opportunityId);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  const [formState, setFormState] = useState({
    title: '',
    category: SATSANG_CATEGORIES.CLASS,
    status: SATSANG_STATUSES.ACTIVE,
    description: '',
    imageUrl: '',
    imageAlt: '',
    location: '',
    meetingLink: '',
    startAt: '',
    endAt: '',
  });

  useEffect(() => {
    if (!isEditing) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadOpportunity = async () => {
      setLoading(true);
      setError(null);
      try {
        const opportunities = await fetchSatsangOpportunities(viewer);
        const opp = opportunities.find((o) => o.id === opportunityId);

        if (!isMounted) return;

        if (!opp) {
          setError({
            message: 'The requested Satsang opportunity could not be found.',
            statusCode: 404,
            title: 'Opportunity Not Found',
          });
          return;
        }

        setFormState({
          title: opp.title || '',
          category: opp.category || SATSANG_CATEGORIES.CLASS,
          status: opp.status || SATSANG_STATUSES.ACTIVE,
          description: opp.description || '',
          imageUrl: opp.imageUrl || '',
          imageAlt: opp.imageAlt || '',
          location: opp.location || '',
          meetingLink: opp.meetingLink || '',
          startAt: formatTimestampForInput(opp.startAt),
          endAt: formatTimestampForInput(opp.endAt),
        });
      } catch (err) {
        console.error('Failed to load opportunity:', err);
        if (isMounted) {
          setError({
            message: err.message || 'We could not load this opportunity right now.',
            statusCode: 500,
            title: 'Error Loading Opportunity',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOpportunity();

    return () => {
      isMounted = false;
    };
  }, [isEditing, opportunityId, viewer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setFeedback({ error: '', success: '' });
  };

  const handleSubmit = async (action) => {
    setFieldErrors({});
    setFeedback({ error: '', success: '' });

    if (!formState.title.trim()) {
      setFieldErrors({ title: 'Opportunity Title is required.' });
      return;
    }

    setSaving(action);

    try {
      if (isEditing) {
        await updateSatsangOpportunity(viewer, opportunityId, formState);
        setFeedback({ error: '', success: 'Opportunity updated successfully.' });
      } else {
        await createSatsangOpportunity(viewer, formState);
        setFeedback({ error: '', success: 'Opportunity created successfully.' });
      }

      if (action === 'save-back' && typeof onSaved === 'function') {
        onSaved();
      }
    } catch (err) {
      console.error('Failed to save opportunity:', err);
      setFeedback({
        error: err.message || 'Failed to save opportunity. Please check input fields.',
        success: '',
      });
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <section className="admin-page-hero">
          <div className="admin-skeleton admin-skeleton-title" />
        </section>
        <section className="admin-skeleton admin-skeleton-panel" />
      </div>
    );
  }

  if (error) {
    return (
      <AppStatusView
        actions={[{ label: 'Back to Maṇḍala Updates', onClick: onBack }]}
        state={error}
      />
    );
  }

  return (
    <div className="admin-profile-page admin-quiz-editor-page">
      {/* Page Header */}
      <section className="admin-profile-hero admin-admin-hero">
        <div className="admin-page-hero-actions">
          <button className="secondary-cta is-compact" onClick={onBack} type="button">
            Back to Maṇḍala Updates
          </button>
        </div>
        <div className="admin-profile-identity-copy">
          <span className="admin-profile-eyebrow">Maṇḍala Updates</span>
          <h1>{isEditing ? 'Edit Opportunity' : 'Create Opportunity'}</h1>
          <p>
            {isEditing
              ? 'Update details for this Satsang Central class, event, or festival.'
              : 'Add a new spiritual opportunity visible to users on Satsang Central.'}
          </p>
        </div>
      </section>

      {/* Feedback */}
      {feedback.error ? (
        <div className="admin-profile-feedback-card is-error">{feedback.error}</div>
      ) : null}

      {feedback.success ? (
        <div className="admin-profile-feedback-card is-success">{feedback.success}</div>
      ) : null}

      {/* Section 1: Basic Information */}
      <section className="admin-panel admin-profile-form-shell admin-quiz-editor-shell">
        <div className="admin-profile-section-heading">
          <h2>Basic Information</h2>
          <p>Define the title, category, and visibility status.</p>
        </div>

        <div className="admin-profile-form-grid">
          <label className="admin-profile-field">
            <span>Opportunity Title *</span>
            <input
              name="title"
              onChange={handleChange}
              placeholder="e.g. Bhagavad Gita Class, Sunday Feast, Janmashtami"
              type="text"
              value={formState.title}
            />
            <FieldError message={fieldErrors.title} />
          </label>

          <label className="admin-profile-field">
            <span>Category *</span>
            <select
              name="category"
              onChange={handleChange}
              value={formState.category}
            >
              <option value={SATSANG_CATEGORIES.CLASS}>Class</option>
              <option value={SATSANG_CATEGORIES.EVENT}>Event</option>
              <option value={SATSANG_CATEGORIES.FESTIVAL}>Festival</option>
            </select>
          </label>

          <label className="admin-profile-field">
            <span>Status *</span>
            <select
              name="status"
              onChange={handleChange}
              value={formState.status}
            >
              <option value={SATSANG_STATUSES.ACTIVE}>ACTIVE — Visible to users</option>
              <option value={SATSANG_STATUSES.INACTIVE}>INACTIVE — Hidden</option>
            </select>
          </label>

          <label className="admin-profile-field admin-quiz-field-wide">
            <span>Short Description</span>
            <textarea
              name="description"
              onChange={handleChange}
              placeholder="Brief overview of the activity, speaker, topics covered..."
              rows={3}
              value={formState.description}
            />
          </label>
        </div>
      </section>

      {/* Section 2: Media & Location */}
      <section className="admin-panel admin-profile-form-shell admin-quiz-editor-shell">
        <div className="admin-profile-section-heading">
          <h2>Media & Location</h2>
          <p>Optionally provide a cover image, physical venue, or online meeting link.</p>
        </div>

        <div className="admin-profile-form-grid">
          <label className="admin-profile-field">
            <span>Image URL</span>
            <input
              name="imageUrl"
              onChange={handleChange}
              placeholder="https://..."
              type="url"
              value={formState.imageUrl}
            />
          </label>

          <label className="admin-profile-field">
            <span>Image Alt Text</span>
            <input
              name="imageAlt"
              onChange={handleChange}
              placeholder="Descriptive image text"
              type="text"
              value={formState.imageAlt}
            />
          </label>

          <label className="admin-profile-field">
            <span>Physical Location</span>
            <input
              name="location"
              onChange={handleChange}
              placeholder="Temple Hall, City Center, Main Sanctuary..."
              type="text"
              value={formState.location}
            />
          </label>

          <label className="admin-profile-field">
            <span>Online Meeting Link</span>
            <input
              name="meetingLink"
              onChange={handleChange}
              placeholder="https://zoom.us/j/..."
              type="url"
              value={formState.meetingLink}
            />
          </label>
        </div>
      </section>

      {/* Section 3: Schedule */}
      <section className="admin-panel admin-profile-form-shell admin-quiz-editor-shell">
        <div className="admin-profile-section-heading">
          <h2>Schedule & Timings</h2>
          <p>Optionally set start and end date/time for scheduled sessions.</p>
        </div>

        <div className="admin-profile-form-grid">
          <label className="admin-profile-field">
            <span>Start Date & Time</span>
            <input
              name="startAt"
              onChange={handleChange}
              type="datetime-local"
              value={formState.startAt}
            />
          </label>

          <label className="admin-profile-field">
            <span>End Date & Time</span>
            <input
              name="endAt"
              onChange={handleChange}
              type="datetime-local"
              value={formState.endAt}
            />
          </label>

          <div className="admin-form-empty-slot" />
        </div>
      </section>

      {/* Sticky Footer Actions */}
      <div className="admin-quiz-editor-actions">
        <button
          className="secondary-cta is-compact"
          disabled={Boolean(saving)}
          onClick={onBack}
          type="button"
        >
          Cancel
        </button>

        <button
          className="primary-cta is-compact"
          disabled={Boolean(saving)}
          onClick={() => handleSubmit('save-stay')}
          type="button"
        >
          {saving === 'save-stay' ? 'Saving...' : (isEditing ? 'Save Changes' : 'Save Draft')}
        </button>

        <button
          className="primary-cta is-compact"
          disabled={Boolean(saving)}
          onClick={() => handleSubmit('save-back')}
          type="button"
        >
          {saving === 'save-back' ? 'Saving...' : 'Save & Go Back'}
        </button>
      </div>
    </div>
  );
}
