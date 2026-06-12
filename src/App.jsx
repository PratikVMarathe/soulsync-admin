import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppErrorBoundary from './components/AppErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import { AppNoticeProvider } from './context/AppNoticeContext';
import AdminWorkspace from './AdminWorkspace';
import { useAppNotice } from './hooks/useAppNotice';
import AdminAccessPage from './pages/AdminAccessPage';
import NotFoundPage from './pages/NotFoundPage';
import {
  getAdminAuthErrorState,
  signInAsAdmin,
  signOutAdmin,
  subscribeToAdminSession,
} from './services/adminSession';

function AdminRoutes() {
  const [viewer, setViewer] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [signInPending, setSignInPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const { showNotice } = useAppNotice();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = subscribeToAdminSession({
      onError: (error) => {
        console.error('SoulSync Admin session error:', error);
        setSessionError(getAdminAuthErrorState(error));
      },
      onResolved: (resolvedViewer) => {
        setViewer(resolvedViewer);
        setSessionLoading(false);
        setSignInPending(false);

        if (resolvedViewer) {
          setSessionError(null);
        }
      },
    });

    return unsubscribe;
  }, []);

  const handleSignIn = useCallback(async () => {
    setSessionError(null);
    setSignInPending(true);

    try {
      await signInAsAdmin();
    } catch (error) {
      console.error('SoulSync Admin sign in failed:', error);
      setSessionError(getAdminAuthErrorState(error));
      setSignInPending(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setSignOutPending(true);

    try {
      await signOutAdmin();
      setSessionError(null);
    } catch (error) {
      console.error('SoulSync Admin sign out failed:', error);
      showNotice('We could not sign you out right now. Please try again.', 'error');
    } finally {
      setSignOutPending(false);
    }
  }, [showNotice]);

  if (sessionLoading) {
    return <LoadingScreen message="Checking your admin access..." />;
  }

  return (
    <AppErrorBoundary
      onRetry={() => window.location.reload()}
      resetKey={`${location.pathname}:${viewer?.uid || 'guest'}`}
    >
      <AppNoticeCenter />

      <Routes>
        <Route path="/" element={<Navigate replace to="/admin" />} />
        <Route
          path="/admin"
          element={viewer ? (
            <AdminWorkspace
              onSignOut={handleSignOut}
              signOutPending={signOutPending}
              viewer={viewer}
            />
          ) : (
            <AdminAccessPage
              errorState={sessionError}
              onSignIn={handleSignIn}
              signingIn={signInPending}
            />
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppNoticeProvider>
        <AdminRoutes />
      </AppNoticeProvider>
    </BrowserRouter>
  );
}
