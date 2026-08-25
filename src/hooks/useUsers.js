import { useCallback, useEffect, useRef, useState } from 'react';
import { listUsers } from '../services/userManagementService';
import { resolveAppErrorState } from '../utils/resolveAppErrorState';

const EMPTY_STATE = {
  users: [],
  hasMore: false,
  lastVisible: null,
};

/**
 * Hook for paginated user listing.
 * Manages cursor history for Prev/Next navigation.
 *
 * Search by name is limited to prefix queries (Firestore limitation).
 * When searchField is active, pagination resets.
 */
export function useUsers({ status = 'ALL', searchField = null, searchTerm = '' } = {}, viewer) {
  const [pageData, setPageData] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Cursor stack: index 0 = first page (no cursor), each push = next page cursor
  const [cursorStack, setCursorStack] = useState([null]);
  const [pageIndex, setPageIndex] = useState(0);

  const abortRef = useRef(false);

  const fetch = useCallback(async (cursor) => {
    abortRef.current = false;
    setLoading(true);

    try {
      const result = await listUsers(
        { status, cursor, searchField, searchTerm },
        viewer,
      );

      if (abortRef.current) return;

      setPageData(result);
      setError(null);
    } catch (loadError) {
      if (abortRef.current) return;

      const isPermissionError = loadError?.code === 'user-management/forbidden'
        || loadError?.code === 'permission-denied';

      setError(resolveAppErrorState(loadError, {
        message: loadError?.publicMessage || (
          isPermissionError
            ? 'You do not have permission to view user management.'
            : 'We could not load users right now.'
        ),
        statusCode: isPermissionError ? 403 : 500,
        title: isPermissionError ? 'Access Denied' : 'Could Not Load Users',
      }));
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [status, searchField, searchTerm, viewer, reloadToken]); // eslint-disable-line

  // Reset pagination when filters change
  useEffect(() => {
    abortRef.current = true;
    setCursorStack([null]);
    setPageIndex(0);
    fetch(null);
  }, [status, searchField, searchTerm, viewer, reloadToken]); // eslint-disable-line

  const nextPage = useCallback(() => {
    if (!pageData.hasMore || !pageData.lastVisible) return;

    const newStack = [...cursorStack.slice(0, pageIndex + 1), pageData.lastVisible];
    setCursorStack(newStack);
    const nextIndex = pageIndex + 1;
    setPageIndex(nextIndex);
    fetch(pageData.lastVisible);
  }, [pageData, cursorStack, pageIndex, fetch]);

  const prevPage = useCallback(() => {
    if (pageIndex === 0) return;

    const prevIndex = pageIndex - 1;
    setPageIndex(prevIndex);
    fetch(cursorStack[prevIndex]);
  }, [pageIndex, cursorStack, fetch]);

  return {
    users: pageData.users,
    hasMore: pageData.hasMore,
    loading,
    error,
    pageIndex,
    hasPrev: pageIndex > 0,
    retry: () => setReloadToken((n) => n + 1),
    nextPage,
    prevPage,
  };
}
