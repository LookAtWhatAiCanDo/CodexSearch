import { useEffect, useRef } from 'react';
import { ResultCard } from './ResultCard.tsx';
import type { SearchResult } from '../types.ts';

interface Props {
  results: SearchResult[];
  loading: boolean;
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ResultList({ results, loading, query, selectedId, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!results.length) return;
      const idx = results.findIndex(r => r.session.id === selectedId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(idx + 1, results.length - 1);
        onSelect(results[next].session.id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(idx - 1, 0);
        onSelect(results[prev].session.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, selectedId, onSelect]);

  if (loading) {
    return <div className="empty-state"><p>Searching…</p></div>;
  }

  if (!results.length) {
    return (
      <div className="empty-state">
        <h3>{query ? 'No results' : 'No sessions found'}</h3>
        <p>{query ? `Nothing matched "${query}"` : 'Could not read ~/.codex — is Codex installed?'}</p>
      </div>
    );
  }

  return (
    <div ref={listRef}>
      <div className="results-count">
        {results.length} result{results.length !== 1 ? 's' : ''}
        {query ? ` for "${query}"` : ''}
      </div>
      {results.map(r => (
        <ResultCard
          key={r.session.id}
          result={r}
          selected={r.session.id === selectedId}
          onClick={() => onSelect(r.session.id)}
        />
      ))}
    </div>
  );
}
