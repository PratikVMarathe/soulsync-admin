import { useEffect, useState } from 'react';
import { loadQuizManagementSnapshot } from '../services/quizManagementService';
import { resolveAppErrorState } from '../utils/resolveAppErrorState';

export function useQuizManagementData(viewer) {
  const [data, setData] = useState({
    draftCount: 0,
    drafts: [],
    quizzes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);

      try {
        const snapshot = await loadQuizManagementSnapshot(viewer);

        if (!isMounted) return;

        setData(snapshot);
        setError(null);
      } catch (loadError) {
        if (!isMounted) return;

        const isPermissionError = loadError?.code === 'quiz-management/forbidden'
          || loadError?.code === 'permission-denied'
          || loadError?.code === 'firestore/permission-denied';

        setError(resolveAppErrorState(loadError, {
          message: loadError?.publicMessage || (
            isPermissionError
              ? 'Firestore rules blocked Quiz Management. Allow Admin and Super Admin access to quizzes and quiz audit logs.'
              : 'We could not load quiz management data right now.'
          ),
          statusCode: isPermissionError ? 403 : 500,
          title: isPermissionError
            ? 'Quiz Management Access Blocked'
            : 'Could Not Load Quiz Management',
        }));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [reloadToken, viewer]);

  return {
    data,
    error,
    loading,
    retry: () => setReloadToken((currentValue) => currentValue + 1),
  };
}
