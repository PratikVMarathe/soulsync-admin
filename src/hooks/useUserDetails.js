import { useCallback, useEffect, useState } from 'react';
import { getUserByUid, getUserQuizSummary } from '../services/userManagementService';
import { resolveAppErrorState } from '../utils/resolveAppErrorState';

/**
 * Hook for loading a single user's profile and quiz summary.
 * Used by UserDetailsPage.
 */
export function useUserDetails(uid, viewer) {
  const [user, setUser] = useState(null);
  const [quizSummary, setQuizSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    if (!uid) return;

    setLoading(true);

    try {
      const [profile, summary] = await Promise.all([
        getUserByUid(uid, viewer),
        getUserQuizSummary(uid, viewer),
      ]);

      setUser(profile);
      setQuizSummary(summary);
      setError(null);
    } catch (loadError) {
      const isNotFound = loadError?.code === 'user-management/not-found'
        || loadError?.code === 'not-found';
      const isPermission = loadError?.code === 'user-management/forbidden'
        || loadError?.code === 'permission-denied';

      setError(resolveAppErrorState(loadError, {
        message: loadError?.publicMessage || (
          isNotFound
            ? 'This user profile does not exist.'
            : isPermission
              ? 'You do not have permission to view this user.'
              : 'We could not load this user right now.'
        ),
        statusCode: isNotFound ? 404 : isPermission ? 403 : 500,
        title: isNotFound ? 'User Not Found' : isPermission ? 'Access Denied' : 'Could Not Load User',
      }));
    } finally {
      setLoading(false);
    }
  }, [uid, viewer, reloadToken]); // eslint-disable-line

  useEffect(() => {
    let isMounted = true;

    load().catch(() => {
      if (!isMounted) return;
    });

    return () => {
      isMounted = false;
    };
  }, [load]);

  return {
    user,
    quizSummary,
    loading,
    error,
    retry: () => setReloadToken((n) => n + 1),
    setUser,
  };
}
