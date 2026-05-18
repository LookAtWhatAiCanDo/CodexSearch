import { useState, useCallback, useDeferredValue } from 'react';
import { SearchBar } from './components/SearchBar.tsx';
import { ResultList } from './components/ResultList.tsx';
import { SessionDetail } from './components/SessionDetail.tsx';
import { useSearch } from './hooks/useSearch.ts';
import type { FilterMode } from './hooks/useSearch.ts';

export default function App() {
  const [rawQuery, setRawQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce search via deferred value
  const query = useDeferredValue(rawQuery);

  const { results, loading, status } = useSearch(query, filter);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleClose = useCallback(() => setSelectedId(null), []);

  return (
    <div className="app">
      <SearchBar
        query={rawQuery}
        filter={filter}
        status={status}
        onQueryChange={q => { setRawQuery(q); setSelectedId(null); }}
        onFilterChange={f => { setFilter(f); setSelectedId(null); }}
      />
      <div className="layout">
        <div className="list-pane">
          <ResultList
            results={results}
            loading={loading}
            query={query}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>
        {selectedId && (
          <SessionDetail sessionId={selectedId} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}
