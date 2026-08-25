import { useEffect, useRef, useState } from 'react';
import AdminIcon from './AdminIcon';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Users' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'SOFT_DELETED', label: 'Soft Deleted' },
];

export default function UserStatusFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = STATUS_OPTIONS.find((opt) => opt.value === value)?.label || 'All Users';

  return (
    <div className="user-status-filter-wrapper" ref={containerRef}>
      {/* Desktop Tabs */}
      <div className="user-status-filter is-desktop" role="group" aria-label="Filter by status">
        {STATUS_OPTIONS.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={`user-status-filter-btn${value === option.value ? ' is-active' : ''}`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Mobile Dropdown */}
      <div className="user-status-filter is-mobile">
        <button
          className="user-status-filter-trigger"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          aria-expanded={isOpen}
          aria-label="Filter users"
        >
          <AdminIcon name="filter" size={18} />
        </button>

        {isOpen && (
          <div className="user-status-filter-dropdown" role="menu">
            {STATUS_OPTIONS.map((option) => (
              <button
                className={`user-status-filter-dropdown-item${value === option.value ? ' is-selected' : ''}`}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
