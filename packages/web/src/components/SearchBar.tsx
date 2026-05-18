import { useRef, useEffect } from 'react';
import type { FilterMode } from '../hooks/useSearch.ts';
import type { StatusResponse } from '../types.ts';

interface Props {
  query: string;
  filter: FilterMode;
  status: StatusResponse | null;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: FilterMode) => void;
}

export function SearchBar({ query, filter, status, onQueryChange, onFilterChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Press '/' to focus search bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filters: { value: FilterMode; label: string }[] = [
    { value: 'all', label: 'All sessions' },
    { value: 'archived', label: 'Archived only' },
    { value: 'active', label: 'Active only' },
  ];

  const age = status ? formatAge(status.indexAge) : null;

  return (
    <div className="header">
      <div className="header-top">
        <span className="logo">Codex<span>Search</span></span>
        {status && (
          <span className="status-pill">
            {status.sessionCount} sessions · index {age}
          </span>
        )}
      </div>
      <div className="search-row">
        <div className="search-input-wrap">
          <span className="search-icon">⌕</span>
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder='Search sessions… (press "/" to focus)'
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { onQueryChange(''); inputRef.current?.blur(); } }}
            autoFocus
          />
          {query && (
            <button className="clear-btn" onClick={() => onQueryChange('')}>×</button>
          )}
        </div>
      </div>
      <div className="filter-tabs">
        {filters.map(f => (
          <button
            key={f.value}
            className={`filter-tab ${filter === f.value ? 'active' : ''}`}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatAge(ms: number): string {
  if (ms < 1000) return 'just built';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s old`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m old`;
  return `${Math.round(ms / 3_600_000)}h old`;
}
