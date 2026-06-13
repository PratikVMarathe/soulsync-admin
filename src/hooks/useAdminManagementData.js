import { useEffect, useState } from 'react';
import { loadAdminManagementSnapshot } from '../services/adminInviteService';
import { resolveAppErrorState } from '../utils/resolveAppErrorState';

export function useAdminManagementData(viewer) {
  const [data, setData] = useState({
    admins: [],
    invites: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);

      try {
        const nextSnapshot = await loadAdminManagementSnapshot(viewer);

        if (!isMounted) return;

        setData(nextSnapshot);
        setError(null);
      } catch (loadError) {
        if (!isMounted) return;

        const isPermissionError = loadError?.code === 'admin-invite/forbidden'
          || loadError?.code === 'permission-denied'
          || loadError?.code === 'firestore/permission-denied';

        setError(resolveAppErrorState(loadError, {
          message: loadError?.publicMessage || (
            isPermissionError
              ? 'Firestore rules blocked access to admin management. Allow Admin and Super Admin read access to users and adminInvites.'
              : 'We could not load admin invite data right now.'
          ),
          statusCode: isPermissionError ? 403 : 500,
          title: isPermissionError
            ? 'Admin Management Access Blocked'
            : 'Could Not Load Admin Management',
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
