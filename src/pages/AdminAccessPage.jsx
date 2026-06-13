import Brand from '../components/Brand';
import { formatRoleLabel } from '../utils/formatters';

const allowedRoles = ['SUPER_ADMIN', 'ADMIN'];

export default function AdminAccessPage({
  errorState,
  onSignIn,
  signingIn,
}) {
  return (
    <section className="admin-access-shell">
      <div className="admin-access-card">
        <div className="admin-access-copy">
          <Brand />

          <span className="admin-badge">SoulSync Admin</span>
          <h1>Manage users, admins, and quiz operations from one focused workspace.</h1>
          <p>
            This dashboard is reserved for approved admin accounts. Sign in with Google, then we
            will verify your Firestore profile and role before opening the console.
          </p>

          <ul className="admin-access-points">
            <li>Live Firestore counts for users, admins, and quiz status.</li>
            <li>Role-aware controls for Admin and Super Admin accounts.</li>
            <li>Shared error states so the admin app fails gracefully when a service is down.</li>
          </ul>
        </div>

        <div className="admin-access-panel">
          <div className="admin-access-role-list">
            <span className="admin-access-label">Allowed roles</span>
            <div className="admin-access-role-pills">
              {allowedRoles.map((role) => (
                <span className="admin-role-pill" key={role}>
                  {formatRoleLabel(role)}
                </span>
              ))}
            </div>
          </div>

          {errorState ? (
            <div className="admin-inline-alert" role="alert">
              <strong>{errorState.title || 'Sign in failed'}</strong>
              <p>{errorState.message}</p>
            </div>
          ) : null}

          <button className="primary-cta" disabled={signingIn} onClick={onSignIn} type="button">
            {signingIn ? 'Opening Google...' : 'Continue with Google'}
          </button>

          <p className="admin-access-footnote">
            First-time admin access is created from a Super Admin invite. If this Google account is
            not invited yet, SoulSync will block the session and ask a Super Admin to create access first.
          </p>
        </div>
      </div>
    </section>
  );
}
