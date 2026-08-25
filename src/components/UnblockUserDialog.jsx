import AdminIcon from './AdminIcon';

/**
 * Confirmation dialog for unblocking a user.
 */
export default function UnblockUserDialog({ user, onConfirm, onClose, isLoading }) {
  const displayName = user?.name || user?.email || 'this user';

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label="Unblock User">
      <div className="admin-modal admin-modal-narrow">
        <div className="admin-modal-header">
          <AdminIcon name="userPlus" size={20} />
          <strong>Unblock User?</strong>
          <button aria-label="Close" className="admin-icon-button" onClick={onClose} type="button">
            <AdminIcon name="close" size={18} />
          </button>
        </div>

        <div className="admin-modal-body">
          <p>
            Unblock <strong>{displayName}</strong>?
          </p>
          <p className="user-dialog-note">
            They will regain access to active user features.
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
            className="primary-cta is-compact"
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? 'Unblocking…' : 'Unblock User'}
          </button>
        </div>
      </div>
    </div>
  );
}
