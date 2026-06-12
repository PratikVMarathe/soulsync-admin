import { NavLink } from 'react-router-dom';
import { SIDEBAR_ITEMS } from '../constants/adminShell';
import { formatRoleLabel, getInitials } from '../utils/formatters';
import AdminIcon from './AdminIcon';
import Brand from './Brand';

function canAccessItem(item, role) {
  return !item.roles || item.roles.includes(role);
}

export default function AdminSidebar({
  currentSection,
  isDesktopViewport,
  isExpanded,
  onAction,
  onExpandedChange,
  onSignOut,
  signOutPending,
  viewer,
}) {
  const items = SIDEBAR_ITEMS.filter((item) => canAccessItem(item, viewer.role));

  const handleBlurCapture = (event) => {
    if (!isDesktopViewport) return;

    if (!event.currentTarget.contains(event.relatedTarget)) {
      onExpandedChange(false);
    }
  };

  const handleItemSelect = (itemKey) => {
    onAction(itemKey);
    onExpandedChange(false);
  };

  return (
    <>
      <button
        aria-hidden={isDesktopViewport || !isExpanded}
        className={`admin-sidebar-backdrop${!isDesktopViewport && isExpanded ? ' is-visible' : ''}`}
        onClick={() => onExpandedChange(false)}
        tabIndex={!isDesktopViewport && isExpanded ? 0 : -1}
        type="button"
      />

      <aside
        aria-label="Admin navigation"
        className={`admin-sidebar${isExpanded ? ' is-expanded' : ''}${isDesktopViewport ? ' is-desktop' : ' is-mobile'}`}
        onBlurCapture={handleBlurCapture}
        onFocusCapture={() => {
          if (isDesktopViewport) onExpandedChange(true);
        }}
        onMouseEnter={() => {
          if (isDesktopViewport) onExpandedChange(true);
        }}
        onMouseLeave={() => {
          if (isDesktopViewport) onExpandedChange(false);
        }}
      >
        <div className="admin-sidebar-inner">
          <div className="admin-sidebar-header">
            <Brand compact iconOnly={isDesktopViewport && !isExpanded} />
          </div>

          <nav aria-label="Admin navigation" className="admin-sidebar-nav">
            {items.map((item) => {
              if (item.route) {
                return (
                  <NavLink
                    className={({ isActive }) => `admin-sidebar-link${isActive ? ' is-active' : ''}`}
                    end
                    key={item.key}
                    onClick={() => onExpandedChange(false)}
                    to={item.route}
                  >
                    <AdminIcon name={item.icon} size={21} />
                    <span className="admin-sidebar-label">{item.label}</span>
                  </NavLink>
                );
              }

              return (
                <button
                  className={`admin-sidebar-link${currentSection === item.key ? ' is-active' : ''}`}
                  key={item.key}
                  onClick={() => handleItemSelect(item.key)}
                  type="button"
                >
                  <AdminIcon name={item.icon} size={21} />
                  <span className="admin-sidebar-label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <button
              className="admin-sidebar-profile"
              onClick={() => {
                handleItemSelect('profile');
              }}
              type="button"
            >
              <span className="admin-sidebar-avatar">{getInitials(viewer.displayName)}</span>
              <span className="admin-sidebar-profile-copy">
                <strong>{viewer.displayName}</strong>
                <span>{formatRoleLabel(viewer.role)}</span>
              </span>
              <AdminIcon className="admin-sidebar-profile-chevron" name="chevron" size={18} />
            </button>

            {!isDesktopViewport ? (
              <button className="admin-signout-button admin-sidebar-signout" disabled={signOutPending} onClick={onSignOut} type="button">
                <AdminIcon name="logout" size={18} />
                <span>{signOutPending ? 'Signing out...' : 'Sign out'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
