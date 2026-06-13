import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppErrorBoundary from './components/AppErrorBoundary';
import AppNoticeCenter from './components/AppNoticeCenter';
import AdminLayout from './components/AdminLayout';
import { ACTION_MESSAGES } from './constants/adminShell';
import { useAppNotice } from './hooks/useAppNotice';
import AdminCreateInvitePage from './pages/AdminCreateInvitePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminEditManagedProfilePage from './pages/AdminEditManagedProfilePage';
import AdminManagementPage from './pages/AdminManagementPage';
import AdminProfilePage from './pages/AdminProfilePage';
import AppStatusView from './components/AppStatusView';

export default function AdminWorkspace({
  onPlaceholderAction,
  onUserChange,
  onSignOut,
  signOutPending = false,
  viewer,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showNotice } = useAppNotice();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/admin';
  const isProfileRoute = normalizedPath === '/admin/profile';
  const isDashboardRoute = normalizedPath === '/admin';
  const isAdminManagementRoute = normalizedPath === '/admin/admins';
  const isCreateAdminRoute = normalizedPath === '/admin/admins/create';
  const editAdminMatch = normalizedPath.match(/^\/admin\/admins\/([^/]+)\/edit$/);
  const editingAdminId = editAdminMatch?.[1] || null;

  const handlePlaceholderAction = useCallback((actionKey) => {
    if (actionKey === 'profile') {
      navigate('/admin/profile');
      return;
    }

    if (actionKey === 'create-admin') {
      navigate('/admin/admins/create');
      return;
    }

    if (actionKey === 'admin-management') {
      navigate('/admin/admins');
      return;
    }

    if (onPlaceholderAction) {
      onPlaceholderAction(actionKey);
      return;
    }

    showNotice(
      ACTION_MESSAGES[actionKey] || 'This part of the admin workflow is planned for the next phase.',
      'info',
    );
  }, [navigate, onPlaceholderAction, showNotice]);

  const currentSection = isProfileRoute
    ? 'profile'
    : normalizedPath.startsWith('/admin/admins')
      ? 'admin-management'
      : 'dashboard';

  return (
    <AppErrorBoundary
      onRetry={() => window.location.reload()}
      resetKey={`admin:${viewer?.uid || 'guest'}`}
    >
      <AppNoticeCenter />

      <AdminLayout
        currentSection={currentSection}
        onSidebarAction={handlePlaceholderAction}
        onSignOut={onSignOut}
        signOutPending={signOutPending}
        viewer={viewer}
      >
        {isDashboardRoute ? <AdminDashboardPage onAction={handlePlaceholderAction} viewer={viewer} /> : null}
        {isAdminManagementRoute ? (
          <AdminManagementPage
            onCreateInvite={() => navigate('/admin/admins/create')}
            onEditAdmin={(adminId) => navigate(`/admin/admins/${adminId}/edit`)}
            viewer={viewer}
          />
        ) : null}
        {isCreateAdminRoute ? (
          <AdminCreateInvitePage
            onBack={() => navigate('/admin/admins')}
            viewer={viewer}
          />
        ) : null}
        {editingAdminId ? (
          <AdminEditManagedProfilePage
            adminId={editingAdminId}
            onBack={() => navigate('/admin/admins')}
            viewer={viewer}
          />
        ) : null}
        {isProfileRoute ? <AdminProfilePage onUserChange={onUserChange} viewer={viewer} /> : null}
        {!isDashboardRoute && !isProfileRoute && !isAdminManagementRoute && !isCreateAdminRoute && !editingAdminId ? (
          <AppStatusView
            state={{
              message: 'The admin page you requested does not exist.',
              statusCode: 404,
              title: 'Admin Page Not Found',
            }}
          />
        ) : null}
      </AdminLayout>
    </AppErrorBoundary>
  );
}
