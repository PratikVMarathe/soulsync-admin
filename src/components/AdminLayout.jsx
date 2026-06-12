import { useEffect, useState } from 'react';
import AdminBottomNav from './AdminBottomNav';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';

export default function AdminLayout({
  children,
  currentSection = 'dashboard',
  onSidebarAction,
  onSignOut,
  signOutPending,
  viewer,
}) {
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth > 1024
  ));
  const [isDesktopSidebarExpanded, setIsDesktopSidebarExpanded] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 1025px)');
    const handleViewportChange = (event) => {
      setIsDesktopViewport(event.matches);
      if (event.matches) {
        setIsMobileSidebarOpen(false);
      } else {
        setIsDesktopSidebarExpanded(false);
      }
    };

    handleViewportChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
      return () => mediaQuery.removeEventListener('change', handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (isDesktopViewport || !isMobileSidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktopViewport, isMobileSidebarOpen]);

  const isSidebarExpanded = isDesktopViewport
    ? isDesktopSidebarExpanded
    : isMobileSidebarOpen;

  const handleSidebarExpandedChange = (nextValue) => {
    if (isDesktopViewport) {
      setIsDesktopSidebarExpanded(nextValue);
      return;
    }

    setIsMobileSidebarOpen(nextValue);
  };

  return (
    <div className="admin-app-shell">
      <div className="admin-background-glow admin-background-glow-one" />
      <div className="admin-background-glow admin-background-glow-two" />

      <AdminSidebar
        currentSection={currentSection}
        isDesktopViewport={isDesktopViewport}
        isExpanded={isSidebarExpanded}
        onAction={onSidebarAction}
        onExpandedChange={handleSidebarExpandedChange}
        onSignOut={onSignOut}
        signOutPending={signOutPending}
        viewer={viewer}
      />

      <div className={`admin-main-column${isSidebarExpanded ? ' is-sidebar-expanded' : ''}`}>
        <AdminTopbar
          isDesktopViewport={isDesktopViewport}
          isSidebarExpanded={isDesktopSidebarExpanded}
          onAction={onSidebarAction}
          onSignOut={onSignOut}
          signOutPending={signOutPending}
          viewer={viewer}
        />

        <main className="admin-main-content">{children}</main>

        <AdminBottomNav
          onAction={onSidebarAction}
          onCloseMenu={() => setIsMobileSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
