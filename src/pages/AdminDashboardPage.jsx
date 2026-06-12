import { QUICK_ACTIONS } from '../constants/adminShell';
import { USER_ROLES } from '../constants/auth';
import { useAdminDashboardData } from '../hooks/useAdminDashboardData';
import { formatQuizLevel, formatRoleLabel, formatShortDate, getInitials, getQuizDisplayTitle } from '../utils/formatters';
import AppStatusView from '../components/AppStatusView';
import AdminIcon from '../components/AdminIcon';
import AdminQuickActionCard from '../components/AdminQuickActionCard';
import AdminStatCard from '../components/AdminStatCard';

function canAccessAction(action, role) {
  return !action.roles || action.roles.includes(role);
}

function getDashboardTitle(role) {
  if (role === USER_ROLES.SUPER_ADMIN) {
    return 'Super Admin Dashboard';
  }

  return 'Admin Dashboard';
}

function getHeaderCtas(actions) {
  return actions.slice(0, 2);
}

function DashboardLoadingState() {
  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div className="admin-skeleton admin-skeleton-title" />
      </section>

      <section className="admin-stat-grid">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="admin-skeleton admin-skeleton-card" key={`stat-${index}`} />
        ))}
      </section>

      <section className="admin-content-grid admin-content-grid-primary">
        <div className="admin-skeleton admin-skeleton-panel" />
        <div className="admin-skeleton admin-skeleton-panel" />
      </section>

      <section className="admin-content-grid admin-content-grid-secondary">
        <div className="admin-skeleton admin-skeleton-panel" />
        <div className="admin-skeleton admin-skeleton-panel" />
      </section>
    </div>
  );
}

function DashboardPanelHeader({ actionKey, onAction, title, subtitle }) {
  return (
    <header className="admin-panel-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      {actionKey ? (
        <button className="admin-inline-link" onClick={() => onAction(actionKey)} type="button">
          View all
        </button>
      ) : null}
    </header>
  );
}

function QuickActionsPanel({ onAction, quickActions }) {
  return (
    <article className="admin-panel admin-panel-quick-actions">
      <DashboardPanelHeader
        onAction={onAction}
        subtitle="Role-based admin shortcuts"
        title="Quick Actions"
      />

      <div className="admin-quick-actions-grid">
        {quickActions.map((action) => (
          <AdminQuickActionCard action={action} key={action.key} onClick={onAction} />
        ))}
      </div>
    </article>
  );
}

function RecentActivityPanel({ activity, onAction }) {
  return (
    <article className="admin-panel admin-panel-recent-activity admin-panel-tall">
      <DashboardPanelHeader
        actionKey="analytics"
        onAction={onAction}
        subtitle="Preview data until audit collections are connected"
        title="Recent Admin Activity"
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Performed By</th>
              <th>Target</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item) => (
              <tr key={`${item.action}-${item.target}`}>
                <td data-label="Action">
                  <div className="admin-table-item">
                    <span className={`admin-mini-icon tone-${item.tone}`}>
                      <AdminIcon
                        name={item.action.toLowerCase().includes('user') ? 'users' : 'book'}
                        size={16}
                      />
                    </span>
                    <span>{item.action}</span>
                  </div>
                </td>
                <td data-label="Performed By">{item.performedBy}</td>
                <td data-label="Target">{item.target}</td>
                <td data-label="Date">{item.date}</td>
                <td data-label="Status">
                  <span className="admin-status-pill is-success">{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function AdminManagementPanel({ admins, onAction }) {
  return (
    <article className="admin-panel admin-panel-admin-management">
      <DashboardPanelHeader
        actionKey="admin-management"
        onAction={onAction}
        subtitle="Current Firestore admin profiles"
        title="Admin Management (Preview)"
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Role</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td data-label="Admin">
                  <div className="admin-table-item">
                    <span className="admin-avatar-dot">{getInitials(admin.name || admin.email)}</span>
                    <span>{admin.name || admin.email || admin.id}</span>
                  </div>
                </td>
                <td data-label="Role">
                  <span className="admin-role-pill">{formatRoleLabel(admin.role)}</span>
                </td>
                <td data-label="Email">{admin.email || 'Not set'}</td>
                <td data-label="Status">
                  <span className="admin-status-pill is-success">{admin.status || 'ACTIVE'}</span>
                </td>
                <td data-label="Actions">
                  <div className="admin-row-actions">
                    <button className="admin-icon-button is-small" onClick={() => onAction('admin-management')} type="button">
                      <AdminIcon name="pencil" size={16} />
                    </button>
                    <button className="admin-icon-button is-small" onClick={() => onAction('admin-management')} type="button">
                      <AdminIcon name="shield" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function UsersOverviewPanel({ onAction, users }) {
  return (
    <article className="admin-panel admin-panel-users-overview">
      <DashboardPanelHeader
        actionKey="view-users"
        onAction={onAction}
        subtitle="Latest user profiles available to admins"
        title="Users Overview (Recent)"
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined On</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td data-label="User">
                  <div className="admin-table-item">
                    <span className="admin-avatar-dot">{getInitials(user.name || user.email)}</span>
                    <span>{user.name || user.email || user.id}</span>
                  </div>
                </td>
                <td data-label="Email">{user.email || 'Not set'}</td>
                <td data-label="Role">
                  <span className="admin-role-pill">{formatRoleLabel(user.role)}</span>
                </td>
                <td data-label="Status">
                  <span className={`admin-status-pill ${user.status === 'BLOCKED' ? 'is-danger' : 'is-success'}`}>
                    {user.status || 'ACTIVE'}
                  </span>
                </td>
                <td data-label="Joined On">{formatShortDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function QuizManagementPanel({ onAction, quizzes }) {
  return (
    <article className="admin-panel admin-panel-quiz-management">
      <DashboardPanelHeader
        actionKey="quiz-management"
        onAction={onAction}
        subtitle="Preview from the quizzes collection"
        title="Quiz Management (Preview)"
      />

      <div className="admin-quiz-card-grid">
        {quizzes.map((quiz) => (
          <article className="admin-quiz-card" key={quiz.id}>
            <span className={`admin-status-pill ${quiz.status === 'ACTIVE' ? 'is-success' : 'is-warning'}`}>
              {quiz.status || 'DRAFT'}
            </span>

            <h3>{getQuizDisplayTitle(quiz.title)}</h3>
            <p>Level: {formatQuizLevel(quiz.level)}</p>

            <div className="admin-quiz-meta">
              <span>
                <AdminIcon name="book" size={15} />
                {quiz.questions?.length || 0}
                {' '}
                Questions
              </span>
              <span>
                <AdminIcon name="fire" size={15} />
                {quiz.timeLimitLabel || quiz.time || `${quiz.estimatedMinutes || 0} min`}
              </span>
            </div>

            <div className="admin-quiz-actions">
              <button className="secondary-cta is-compact" onClick={() => onAction('quiz-management')} type="button">
                Edit
              </button>
              <button className="primary-cta is-compact" onClick={() => onAction('quiz-management')} type="button">
                Toggle Active
              </button>
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}

export default function AdminDashboardPage({ onAction, viewer }) {
  const { data, error, loading, retry } = useAdminDashboardData();
  const role = viewer.role;
  const quickActions = QUICK_ACTIONS.filter((action) => canAccessAction(action, role));
  const headerActions = getHeaderCtas(quickActions);
  const previewActivity = data.activity.slice(0, 4);
  const previewAdmins = data.admins.slice(0, 2);
  const previewQuizzes = data.quizzes.slice(0, 3);
  const previewUsers = data.users.slice(0, 3);

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (error) {
    return (
      <AppStatusView
        actions={[
          { label: 'Try Again', onClick: retry },
        ]}
        state={error}
      />
    );
  }

  const statistics = [
    {
      description: 'Role = USER',
      icon: 'users',
      key: 'totalUsers',
      label: 'Total Users',
      tone: 'forest',
      value: data.statistics?.totalUsers || 0,
    },
    {
      description: 'ADMIN + SUPER_ADMIN',
      icon: 'shield',
      key: 'totalAdmins',
      label: 'Total Admins',
      tone: 'amber',
      value: data.statistics?.totalAdmins || 0,
    },
    {
      description: 'Status = ACTIVE',
      icon: 'book',
      key: 'activeQuizzes',
      label: 'Active Quizzes',
      tone: 'lavender',
      value: data.statistics?.activeQuizzes || 0,
    },
    {
      description: 'Status = INACTIVE',
      icon: 'eyeOff',
      key: 'inactiveQuizzes',
      label: 'Inactive Quizzes',
      tone: 'peach',
      value: data.statistics?.inactiveQuizzes || 0,
    },
    {
      description: 'Status = BLOCKED',
      icon: 'userBlocked',
      key: 'blockedAccounts',
      label: 'Blocked Accounts',
      tone: 'rose',
      value: data.statistics?.blockedAccounts || 0,
    },
  ];

  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div className="admin-page-hero-copy">
          <span className="admin-badge">{formatRoleLabel(role)}</span>
          <h1>{getDashboardTitle(role)}</h1>
          <p>Manage platform activity, users, admins, and quizzes from one place.</p>
        </div>

        <div className="admin-page-hero-actions">
          {headerActions.map((action) => (
            <button className="primary-cta is-compact" key={action.key} onClick={() => onAction(action.key)} type="button">
              <AdminIcon name={action.icon} size={18} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-stat-grid">
        {statistics.map((statistic) => (
          <AdminStatCard
            description={statistic.description}
            icon={statistic.icon}
            key={statistic.key}
            label={statistic.label}
            tone={statistic.tone}
            value={statistic.value}
          />
        ))}
      </section>

      {role === USER_ROLES.SUPER_ADMIN ? (
        <section className="admin-content-grid admin-content-grid-overview">
          <div className="admin-panel-stack">
            <QuickActionsPanel onAction={onAction} quickActions={quickActions} />
            <AdminManagementPanel admins={previewAdmins} onAction={onAction} />
          </div>

          <RecentActivityPanel activity={previewActivity} onAction={onAction} />
        </section>
      ) : null}

      {role !== USER_ROLES.SUPER_ADMIN ? (
        <section className="admin-content-grid admin-content-grid-primary">
          <QuickActionsPanel onAction={onAction} quickActions={quickActions} />
          <RecentActivityPanel activity={previewActivity} onAction={onAction} />
        </section>
      ) : null}

      <section className="admin-content-grid admin-content-grid-tertiary">
        <QuizManagementPanel onAction={onAction} quizzes={previewQuizzes} />
        <UsersOverviewPanel onAction={onAction} users={previewUsers} />
      </section>
    </div>
  );
}
