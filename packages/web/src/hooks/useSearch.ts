import { useState, useEffect, useRef } from 'react';
import type { SearchResult, StatusResponse } from '../types.ts';

export type FilterMode = 'all' | 'archived' | 'active';

export function useSearch(query: string, filter: FilterMode, limit = 50) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch status once on mount
  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then((data: StatusResponse) => setStatus(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ q: query, limit: String(limit), filter });
    fetch(`/api/search?${params}`, { signal: ac.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { results: SearchResult[]; sessionCount: number }) => {
        setResults(data.results);
        setStatus(prev => prev ? { ...prev, sessionCount: data.sessionCount } : null);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(String(err));
        setLoading(false);
      });

    return () => ac.abort();
  }, [query, filter, limit]);

  return { results, loading, error, status };
}
