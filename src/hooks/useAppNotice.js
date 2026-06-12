import { useContext } from 'react';
import { AppNoticeContext } from '../context/appNoticeContextValue';

export function useAppNotice() {
  const context = useContext(AppNoticeContext);

  if (!context) {
    throw new Error('useAppNotice must be used within AppNoticeProvider.');
  }

  return context;
}
