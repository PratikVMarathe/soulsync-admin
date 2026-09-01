import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppErrorBoundary from './components/AppErrorBoundary';
import AppNoticeCenter from './components/AppNoticeCenter';
import AdminLayout from './components/AdminLayout';
import { ACTION_MESSAGES } from './constants/adminShell';
import { useAppNotice } from './hooks/useAppNotice';
import { warmupImageApi } from './services/cloudinaryService';
import AdminCreateInvitePage from './pages/AdminCreateInvitePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminEditManagedProfilePage from './pages/AdminEditManagedProfilePage';
import AdminManagementPage from './pages/AdminManagementPage';
import AdminProfilePage from './pages/AdminProfilePage';
import MandalaOpportunityEditorPage from './pages/MandalaOpportunityEditorPage';
import MandalaUpdatesPage from './pages/MandalaUpdatesPage';
import QuizBulkUploadPage from './pages/QuizBulkUploadPage';
import QuizEditorPage from './pages/QuizEditorPage';
import QuizManagementPage from './pages/QuizManagementPage';
import UserDetailsPage from './pages/UserDetailsPage';
import UserEditPage from './pages/UserEditPage';
import UserManagementPage from './pages/UserManagementPage';
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

  // Opportunistically wake Render image API in background upon Admin loading
  useEffect(() => {
    warmupImageApi();
  }, []);

  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/admin';
  const isProfileRoute = normalizedPath === '/admin/profile';
  const isDashboardRoute = normalizedPath === '/admin';
  const isMandalaRoute = normalizedPath === '/admin/mandala';
  const isCreateMandalaRoute = normalizedPath === '/admin/mandala/create';
  const editMandalaMatch = normalizedPath.match(/^\/admin\/mandala\/([^/]+)\/edit$/);
  const editingOpportunityId = editMandalaMatch?.[1] || null;
  const isAdminManagementRoute = normalizedPath === '/admin/admins';
  const isCreateAdminRoute = normalizedPath === '/admin/admins/create';
  const editAdminMatch = normalizedPath.match(/^\/admin\/admins\/([^/]+)\/edit$/);
  const editingAdminId = editAdminMatch?.[1] || null;
  const isQuizManagementRoute = normalizedPath === '/admin/quizzes';
  const isBulkUploadQuizRoute = normalizedPath === '/admin/quizzes/bulk';
  const isCreateQuizRoute = normalizedPath === '/admin/quizzes/create';
  const editQuizMatch = normalizedPath.match(/^\/admin\/quizzes\/([^/]+)\/edit$/);
  const editingQuizId = editQuizMatch?.[1] || null;
  const isUserManagementRoute = normalizedPath === '/admin/users';
  const userEditMatch = normalizedPath.match(/^\/admin\/users\/([^/]+)\/edit$/);
  const editingUserId = userEditMatch?.[1] || null;
  const userDetailsMatch = normalizedPath.match(/^\/admin\/users\/([^/]+)$/);
  const viewingUserId = userDetailsMatch?.[1] || null;

  const handlePlaceholderAction = useCallback((actionKey) => {
    if (actionKey === 'profile') {
      navigate('/admin/profile');
      return;
    }

    if (actionKey === 'mandala-updates') {
      navigate('/admin/mandala');
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

    if (actionKey === 'quiz-management') {
      navigate('/admin/quizzes');
      return;
    }

    if (actionKey === 'user-management' || actionKey === 'view-users') {
      navigate('/admin/users');
      return;
    }

    if (actionKey === 'create-quiz') {
      navigate('/admin/quizzes/create');
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
    : normalizedPath.startsWith('/admin/mandala')
      ? 'mandala-updates'
      : normalizedPath.startsWith('/admin/quizzes')
        ? 'quiz-management'
        : normalizedPath.startsWith('/admin/admins')
          ? 'admin-management'
          : normalizedPath.startsWith('/admin/users')
            ? 'user-management'
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
        {isMandalaRoute ? (
          <MandalaUpdatesPage
            onCreateOpportunity={() => navigate('/admin/mandala/create')}
            onEditOpportunity={(id) => navigate(`/admin/mandala/${id}/edit`)}
            viewer={viewer}
          />
        ) : null}
        {isCreateMandalaRoute ? (
          <MandalaOpportunityEditorPage
            onBack={() => navigate('/admin/mandala')}
            onSaved={() => navigate('/admin/mandala')}
            viewer={viewer}
          />
        ) : null}
        {editingOpportunityId ? (
          <MandalaOpportunityEditorPage
            onBack={() => navigate('/admin/mandala')}
            onSaved={() => navigate('/admin/mandala')}
            opportunityId={editingOpportunityId}
            viewer={viewer}
          />
        ) : null}
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
        {isQuizManagementRoute ? (
          <QuizManagementPage
            onBulkUploadQuiz={() => navigate('/admin/quizzes/bulk')}
            onCreateQuiz={() => navigate('/admin/quizzes/create')}
            onEditQuiz={(quizId) => navigate(`/admin/quizzes/${quizId}/edit`)}
            viewer={viewer}
          />
        ) : null}
        {isBulkUploadQuizRoute ? (
          <QuizBulkUploadPage
            onBack={() => navigate('/admin/quizzes')}
            onSaved={() => navigate('/admin/quizzes')}
            viewer={viewer}
          />
        ) : null}
        {isCreateQuizRoute ? (
          <QuizEditorPage
            onBack={() => navigate('/admin/quizzes')}
            onSaved={(quizId, options = {}) => {
              if (options.stayOnPage && quizId) {
                navigate(`/admin/quizzes/${quizId}/edit`, { replace: true });
                return;
              }
              navigate('/admin/quizzes');
            }}
            viewer={viewer}
          />
        ) : null}
        {editingQuizId ? (
          <QuizEditorPage
            onBack={() => navigate('/admin/quizzes')}
            onSaved={() => {}}
            quizId={editingQuizId}
            viewer={viewer}
          />
        ) : null}
        {isUserManagementRoute ? (
          <UserManagementPage
            onViewUser={(userId) => navigate(`/admin/users/${userId}`)}
            viewer={viewer}
          />
        ) : null}
        {editingUserId ? (
          <UserEditPage
            onBack={() => navigate(`/admin/users/${editingUserId}`)}
            uid={editingUserId}
            viewer={viewer}
          />
        ) : null}
        {viewingUserId && !editingUserId ? (
          <UserDetailsPage
            onBack={() => navigate('/admin/users')}
            uid={viewingUserId}
            viewer={viewer}
          />
        ) : null}
        {isProfileRoute ? <AdminProfilePage onUserChange={onUserChange} viewer={viewer} /> : null}
        {!isDashboardRoute
          && !isProfileRoute
          && !isMandalaRoute
          && !isCreateMandalaRoute
          && !editingOpportunityId
          && !isAdminManagementRoute
          && !isCreateAdminRoute
          && !editingAdminId
          && !isQuizManagementRoute
          && !isBulkUploadQuizRoute
          && !isCreateQuizRoute
          && !editingQuizId
          && !isUserManagementRoute
          && !viewingUserId
          && !editingUserId ? (
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
