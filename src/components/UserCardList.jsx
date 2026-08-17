import { useState } from 'react';
import AdminIcon from './AdminIcon';
import UserStatusBadge from './UserStatusBadge';
import { getInitials } from '../utils/formatters';

/**
 * Mobile/compact card list for users.
 * Each card shows name, email, status, and an overflow menu (⋮) for actions.
 */
export default function UserCardList({ users, onViewUser, onBlockUser, onUnblockUser }) {
  const [openMenu, setOpenMenu] = useState(null);

  if (!users.length) {
    return (
      <div className="admin-empty-state">
        <p>No users found.</p>
      </div>
    );
  }

  const toggleMenu = (uid) => {
    setOpenMenu((current) => (current === uid ? null : uid));
  };

  return (
    <div className="user-card-list">
      {users.map((user) => {
        const displayName = user.name || user.email || user.id;
        const isBlocked = user.status === 'BLOCKED';
        const isSoftDeleted = user.status === 'SOFT_DELETED';
        const isMenuOpen = openMenu === user.id;

        return (
          <div className="user-card" key={user.id}>
            <button
              className="user-card-body"
              onClick={() => onViewUser(user.id)}
              type="button"
            >
              <span className="admin-avatar-dot user-card-avatar">{getInitials(displayName)}</span>

              <div className="user-card-info">
                <strong className="user-card-name">{displayName}</strong>
                <span className="user-card-email">{user.email || user.emailLower || '—'}</span>
                <UserStatusBadge status={user.status} />
              </div>
            </button>

            <div className="user-card-overflow-wrap">
              <button
                aria-expanded={isMenuOpen}
                aria-label="User actions"
                className="user-card-overflow-btn"
                onClick={() => toggleMenu(user.id)}
                type="button"
              >
                <AdminIcon name="ellipsisVertical" size={18} />
              </button>

              {isMenuOpen ? (
                <>
                  <button
                    aria-hidden
                    className="user-card-overlay"
                    onClick={() => setOpenMenu(null)}
                    tabIndex={-1}
                    type="button"
                  />
                  <div className="user-card-menu" role="menu">
                    <button
                      className="user-card-menu-item"
                      onClick={() => { setOpenMenu(null); onViewUser(user.id); }}
                      role="menuitem"
                      type="button"
                    >
                      <AdminIcon name="profile" size={16} />
                      View / Edit
                    </button>

                    {!isSoftDeleted ? (
                      isBlocked ? (
                        <button
                          className="user-card-menu-item"
                          onClick={() => { setOpenMenu(null); onUnblockUser(user); }}
                          role="menuitem"
                          type="button"
                        >
                          <AdminIcon name="userPlus" size={16} />
                          Unblock
                        </button>
                      ) : (
                        <button
                          className="user-card-menu-item is-danger"
                          onClick={() => { setOpenMenu(null); onBlockUser(user); }}
                          role="menuitem"
                          type="button"
                        >
                          <AdminIcon name="userBlocked" size={16} />
                          Block
                        </button>
                      )
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
