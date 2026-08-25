import AdminIcon from './AdminIcon';
import UserStatusBadge from './UserStatusBadge';
import { formatShortDate, getInitials } from '../utils/formatters';

/**
 * Desktop table layout for users.
 * Reuses .admin-table and .admin-table-wrap CSS classes.
 */
export default function UserTable({ users, onViewUser, onBlockUser, onUnblockUser }) {
  if (!users.length) {
    return (
      <div className="admin-empty-state">
        <p>No users found.</p>
      </div>
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th className="is-tablet-hidden">Email</th>
            <th className="is-tablet-hidden">Phone</th>
            <th>Status</th>
            <th className="is-tablet-hidden">Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const displayName = user.name || user.email || user.id;
            const isBlocked = user.status === 'BLOCKED';
            const isSoftDeleted = user.status === 'SOFT_DELETED';

            return (
              <tr key={user.id}>
                <td data-label="User">
                  <div className="admin-table-item">
                    <span className="admin-avatar-dot">{getInitials(displayName)}</span>
                    <span className="user-table-name">{displayName}</span>
                  </div>
                </td>
                <td className="is-tablet-hidden" data-label="Email">
                  {user.email || user.emailLower || '—'}
                </td>
                <td className="is-tablet-hidden" data-label="Phone">
                  {user.phoneNumber || '—'}
                </td>
                <td data-label="Status">
                  <UserStatusBadge status={user.status} />
                </td>
                <td className="is-tablet-hidden" data-label="Joined">
                  {formatShortDate(user.createdAt)}
                </td>
                <td data-label="Actions">
                  <div className="admin-row-actions">
                    <button
                      className="secondary-cta is-compact"
                      onClick={() => onViewUser(user.id)}
                      type="button"
                    >
                      <AdminIcon name="profile" size={15} />
                      <span>View</span>
                    </button>

                    {!isSoftDeleted ? (
                      isBlocked ? (
                        <button
                          className="secondary-cta is-compact"
                          onClick={() => onUnblockUser(user)}
                          type="button"
                        >
                          <AdminIcon name="userPlus" size={15} />
                          <span>Unblock</span>
                        </button>
                      ) : (
                        <button
                          className="ghost-cta is-compact is-danger-ghost"
                          onClick={() => onBlockUser(user)}
                          type="button"
                        >
                          <AdminIcon name="userBlocked" size={15} />
                          <span>Block</span>
                        </button>
                      )
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
