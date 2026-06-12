import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppNoticeContext } from './appNoticeContextValue';

export function AppNoticeProvider({ children }) {
  const [notice, setNotice] = useState(null);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const showNotice = useCallback((message, tone = 'info') => {
    setNotice({
      id: `${Date.now()}`,
      message,
      tone,
    });
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const value = useMemo(() => ({
    clearNotice,
    notice,
    showNotice,
  }), [clearNotice, notice, showNotice]);

  return (
    <AppNoticeContext.Provider value={value}>
      {children}
    </AppNoticeContext.Provider>
  );
}
