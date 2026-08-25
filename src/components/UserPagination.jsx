import AdminIcon from './AdminIcon';

/**
 * Cursor-based pagination controls.
 * Reuses .admin-management-pagination CSS classes.
 */
export default function UserPagination({ hasPrev, hasMore, onPrev, onNext, pageIndex, loading }) {
  const pageNumber = pageIndex + 1;

  return (
    <footer className="admin-management-pagination">
      <span className="user-pagination-label">Page {pageNumber}</span>

      <div className="admin-management-pagination-actions">
        <button
          aria-label="Previous page"
          className="admin-icon-button is-small"
          disabled={!hasPrev || loading}
          onClick={onPrev}
          type="button"
        >
          <AdminIcon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>

        <span className="admin-management-page-chip">{pageNumber}</span>

        <button
          aria-label="Next page"
          className="admin-icon-button is-small is-next"
          disabled={!hasMore || loading}
          onClick={onNext}
          type="button"
        >
          <AdminIcon name="chevron" size={16} />
        </button>
      </div>
    </footer>
  );
}
