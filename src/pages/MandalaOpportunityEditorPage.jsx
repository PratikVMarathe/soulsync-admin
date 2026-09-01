import { useEffect, useState } from 'react';
import AdminIcon from '../components/AdminIcon';
import AppStatusView from '../components/AppStatusView';
import ImagePreviewDialog from '../components/ImagePreviewDialog';
import ImageUploadDialog from '../components/ImageUploadDialog';
import {
  DEFAULT_SOCIAL_LINKS,
  SOCIAL_PLATFORM_CONFIG,
  SOCIAL_PLATFORM_OPTIONS,
  normalizeSocialLinks,
} from '../constants/socialMedia';
import { UPLOAD_FOLDERS } from '../constants/upload';
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
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  const [socialLinkEntries, setSocialLinkEntries] = useState([
    { platform: 'whatsapp', url: '' },
  ]);

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

        const normalizedSocial = normalizeSocialLinks(opp.socialLinks);
        const entries = [];
        const platformKeys = ['whatsapp', 'instagram', 'youtube', 'facebook', 'telegram'];
        for (const p of platformKeys) {
          if (normalizedSocial[p]) {
            entries.push({ platform: p, url: normalizedSocial[p] });
          }
        }
        setSocialLinkEntries(entries.length > 0 ? entries : [{ platform: 'whatsapp', url: '' }]);
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

  const handleAddSocialLink = () => {
    if (socialLinkEntries.length >= 5) return;
    const usedPlatforms = new Set(socialLinkEntries.map((e) => e.platform));
    const allPlatforms = ['whatsapp', 'instagram', 'youtube', 'facebook', 'telegram'];
    const nextPlatform = allPlatforms.find((p) => !usedPlatforms.has(p)) || 'whatsapp';
    setSocialLinkEntries((prev) => [...prev, { platform: nextPlatform, url: '' }]);
  };

  const handleRemoveSocialLink = (index) => {
    if (socialLinkEntries.length <= 1) return;
    setSocialLinkEntries((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`socialLinks.${index}`];
      return next;
    });
    setFeedback({ error: '', success: '' });
  };

  const handleSocialPlatformChange = (index, newPlatform) => {
    setSocialLinkEntries((prev) => prev.map((entry, i) => (
      i === index ? { ...entry, platform: newPlatform } : entry
    )));
    setFieldErrors((prev) => ({ ...prev, [`socialLinks.${index}`]: '' }));
    setFeedback({ error: '', success: '' });
  };

  const handleSocialUrlChange = (index, newUrl) => {
    setSocialLinkEntries((prev) => prev.map((entry, i) => (
      i === index ? { ...entry, url: newUrl } : entry
    )));
    setFieldErrors((prev) => ({ ...prev, [`socialLinks.${index}`]: '' }));
    setFeedback({ error: '', success: '' });
  };

  const handleSubmit = async (action) => {
    setFieldErrors({});
    setFeedback({ error: '', success: '' });

    if (!formState.title.trim()) {
      setFieldErrors({ title: 'Opportunity Title is required.' });
      return;
    }

    // Validate social links
    const socialLinksPayload = { ...DEFAULT_SOCIAL_LINKS };
    const linkErrors = {};
    const usedPlatforms = new Set();

    socialLinkEntries.forEach((entry, index) => {
      const trimmedUrl = (entry.url || '').trim();
      if (trimmedUrl) {
        if (usedPlatforms.has(entry.platform)) {
          linkErrors[`socialLinks.${index}`] = `Duplicate platform: ${SOCIAL_PLATFORM_CONFIG[entry.platform]?.label || entry.platform}`;
        } else {
          usedPlatforms.add(entry.platform);
        }

        const config = SOCIAL_PLATFORM_CONFIG[entry.platform];
        if (config && !config.validate(trimmedUrl)) {
          linkErrors[`socialLinks.${index}`] = config.errorMsg;
        } else {
          socialLinksPayload[entry.platform] = trimmedUrl;
        }
      }
    });

    if (Object.keys(linkErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...linkErrors }));
      setFeedback({ error: 'Please correct the social media URL errors before saving.', success: '' });
      return;
    }

    setSaving(action);

    const payload = {
      ...formState,
      socialLinks: socialLinksPayload,
    };

    try {
      if (isEditing) {
        await updateSatsangOpportunity(viewer, opportunityId, payload);
        setFeedback({ error: '', success: 'Opportunity updated successfully.' });
      } else {
        await createSatsangOpportunity(viewer, payload);
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
            <span>Opportunity Title <span className="admin-required-indicator">*</span></span>
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
            <span>Category <span className="admin-required-indicator">*</span></span>
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
            <span>Status <span className="admin-required-indicator">*</span></span>
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
          <div className="admin-profile-field admin-image-field-group">
            <span>Image URL</span>
            <div className="admin-image-input-row">
              <input
                name="imageUrl"
                onChange={handleChange}
                placeholder="https://..."
                type="url"
                value={formState.imageUrl}
              />
              <div className="admin-image-actions-row">
                <button
                  className="secondary-cta is-compact"
                  onClick={() => setIsUploadDialogOpen(true)}
                  type="button"
                >
                  <AdminIcon name="uploadCloud" size={16} />
                  <span>Upload Image</span>
                </button>
                <button
                  className="secondary-cta is-compact"
                  disabled={!formState.imageUrl}
                  onClick={() => setIsPreviewOpen(true)}
                  type="button"
                >
                  <AdminIcon name="eye" size={16} />
                  <span>Preview</span>
                </button>
              </div>
            </div>
            <FieldError message={fieldErrors.imageUrl} />
          </div>

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
            <span>Time and Location</span>
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

      {/* Section 3: Social Media & Community */}
      <section className="admin-panel admin-profile-form-shell admin-quiz-editor-shell">
        <div className="admin-profile-section-heading admin-section-heading-with-action">
          <div>
            <h2>Social Media & Community</h2>
            <p>Optionally provide social or community links where users can connect and stay updated.</p>
          </div>
          {socialLinkEntries.length < 5 ? (
            <button
              className="secondary-cta is-compact"
              onClick={handleAddSocialLink}
              type="button"
            >
              <AdminIcon name="plus" size={16} />
              <span>Add Link</span>
            </button>
          ) : null}
        </div>

        <div className="admin-social-links-list">
          {socialLinkEntries.map((entry, index) => (
            <div className="admin-social-link-row" key={`social-link-${index}`}>
              <div className="admin-social-link-select-group">
                <select
                  aria-label="Select social media platform"
                  className="admin-social-select"
                  onChange={(e) => handleSocialPlatformChange(index, e.target.value)}
                  value={entry.platform}
                >
                  {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-social-link-input-group">
                <input
                  aria-label={`${SOCIAL_PLATFORM_CONFIG[entry.platform]?.label || 'Social media'} URL`}
                  className={`admin-social-input ${fieldErrors[`socialLinks.${index}`] ? 'is-invalid' : ''}`}
                  onChange={(e) => handleSocialUrlChange(index, e.target.value)}
                  placeholder={SOCIAL_PLATFORM_CONFIG[entry.platform]?.placeholder || 'https://...'}
                  type="url"
                  value={entry.url}
                />
                <FieldError message={fieldErrors[`socialLinks.${index}`]} />
              </div>

              {socialLinkEntries.length > 1 ? (
                <button
                  aria-label={`Remove ${SOCIAL_PLATFORM_CONFIG[entry.platform]?.label || 'social'} link`}
                  className="secondary-cta is-compact admin-social-delete-btn"
                  onClick={() => handleRemoveSocialLink(index)}
                  title="Remove link"
                  type="button"
                >
                  <AdminIcon name="trash" size={16} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Schedule */}
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

      {/* Image Preview Modal */}
      <ImagePreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Maṇḍala Cover Image Preview"
        url={formState.imageUrl}
      />

      {/* Image Upload Modal */}
      <ImageUploadDialog
        folder={UPLOAD_FOLDERS.MANDALA}
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onSuccess={(url) => {
          setFormState((prev) => ({ ...prev, imageUrl: url }));
          setFieldErrors((prev) => ({ ...prev, imageUrl: '' }));
        }}
        title="Upload Opportunity Image"
        viewer={viewer}
      />

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
