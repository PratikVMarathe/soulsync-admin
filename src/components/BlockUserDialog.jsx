import AdminIcon from './AdminIcon';

/**
 * Confirmation dialog for blocking a user.
 * Requires explicit confirmation before any mutation.
 */
export default function BlockUserDialog({ user, onConfirm, onClose, isLoading }) {
  const displayName = user?.name || user?.email || 'this user';

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label="Block User">
      <div className="admin-modal admin-modal-narrow">
        <div className="admin-modal-header">
          <AdminIcon name="userBlocked" size={20} />
          <strong>Block User?</strong>
          <button aria-label="Close" className="admin-icon-button" onClick={onClose} type="button">
            <AdminIcon name="close" size={18} />
          </button>
        </div>

        <div className="admin-modal-body">
          <p>
            Block <strong>{displayName}</strong>?
          </p>
          <p className="user-dialog-note">
            They will no longer be allowed to use active user features until unblocked.
            Their quiz history will remain intact.
          </p>
        </div>

        <div className="admin-modal-footer">
          <button
            className="secondary-cta is-compact"
            disabled={isLoading}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="primary-cta is-compact is-danger"
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? 'Blocking…' : 'Block User'}
          </button>
        </div>
      </div>
    </div>
  );
}
