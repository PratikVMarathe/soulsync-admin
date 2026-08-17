import { useCallback, useEffect, useRef, useState } from 'react';
import AdminIcon from './AdminIcon';
import { sanitizePhoneInput } from '../utils/identity';

const SEARCH_FIELDS = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phoneNumber', label: 'Phone' },
];

const DEBOUNCE_MS = 350;

/**
 * Debounced search bar with field selector.
 * Phone input is sanitized to digits only.
 */
export default function UserSearchBar({ onSearch }) {
  const [field, setField] = useState('name');
  const [term, setTerm] = useState('');
  const debounceRef = useRef(null);

  const fire = useCallback((nextField, nextTerm) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch({ searchField: nextField, searchTerm: nextTerm });
    }, DEBOUNCE_MS);
  }, [onSearch]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleFieldChange = (nextField) => {
    setField(nextField);
    setTerm('');
    onSearch({ searchField: nextField, searchTerm: '' });
  };

  const handleTermChange = (e) => {
    let value = e.target.value;

    if (field === 'phoneNumber') {
      value = sanitizePhoneInput(value);
    }

    setTerm(value);
    fire(field, value);
  };

  const handleClear = () => {
    setTerm('');
    onSearch({ searchField: field, searchTerm: '' });
  };

  return (
    <div className="user-search-bar">
      <select
        aria-label="Search field"
        className="user-search-field-select"
        onChange={(e) => handleFieldChange(e.target.value)}
        value={field}
      >
        {SEARCH_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <div className="user-search-input-wrap">
        <AdminIcon className="user-search-icon" name="search" size={16} />
        <input
          aria-label={`Search by ${field}`}
          className="user-search-input"
          inputMode={field === 'phoneNumber' ? 'numeric' : 'text'}
          maxLength={field === 'phoneNumber' ? 10 : 120}
          onChange={handleTermChange}
          placeholder={
            field === 'phoneNumber'
              ? 'Enter 10-digit phone number'
              : field === 'email'
                ? 'Email prefix…'
                : 'Name prefix…'
          }
          type="text"
          value={term}
        />
        {term ? (
          <button
            aria-label="Clear search"
            className="user-search-clear"
            onClick={handleClear}
            type="button"
          >
            <AdminIcon name="close" size={14} />
          </button>
        ) : null}
      </div>

      {field === 'name' ? (
        <p className="user-search-hint">Name search uses prefix matching (case-sensitive).</p>
      ) : null}
    </div>
  );
}
