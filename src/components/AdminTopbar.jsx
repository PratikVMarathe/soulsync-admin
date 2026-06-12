import { formatRoleLabel, getInitials } from '../utils/formatters';
import AdminIcon from './AdminIcon';
import Brand from './Brand';

export default function AdminTopbar({
  isDesktopViewport,
  isSidebarExpanded,
  onAction,
  onSignOut,
  signOutPending,
  viewer,
}) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <Brand className={`admin-topbar-wordmark${isSidebarExpanded ? ' is-hidden' : ''}`} textOnly />
        {!isDesktopViewport ? <Brand className="admin-mobile-brand" compact /> : null}
      </div>

      <div className="admin-topbar-actions">
        <button
          className="admin-topbar-profile"
          onClick={() => onAction('profile')}
          type="button"
        >
          <span className="admin-topbar-avatar">{getInitials(viewer.displayName)}</span>
          <span className="admin-topbar-profile-copy">
            <strong>{viewer.displayName}</strong>
            <span>{formatRoleLabel(viewer.role)}</span>
          </span>
        </button>
        
        <button
          aria-label="Open notifications"
          className="admin-icon-button"
          onClick={() => onAction('notification-center')}
          type="button"
        >
          <AdminIcon name="bell" size={18} />
        </button>

        <button className="admin-signout-button" disabled={signOutPending} onClick={onSignOut} type="button">
          <AdminIcon name="logout" size={18} />
          <span>{signOutPending ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>
    </header>
  );
}
