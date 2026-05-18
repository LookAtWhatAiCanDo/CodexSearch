import { ArchivedBadge } from './ArchivedBadge.tsx';
import type { SearchResult } from '../types.ts';

interface Props {
  result: SearchResult;
  selected: boolean;
  onClick: () => void;
}

export function ResultCard({ result, selected, onClick }: Props) {
  const { session, matchField, snippet } = result;
  const date = new Date(session.updatedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const shortCwd = session.cwd.replace(/^\/Users\/[^/]+/, '~');

  return (
    <div
      className={`result-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <span className="thread-name">{session.threadName || 'Untitled session'}</span>
        {session.isArchived && <ArchivedBadge />}
      </div>
      <div className="card-meta">
        <span>{date}</span>
        {shortCwd && <span className="cwd">{shortCwd}</span>}
        {session.turnCount > 0 && <span>{session.turnCount} turn{session.turnCount !== 1 ? 's' : ''}</span>}
      </div>
      {snippet && (
        <div className="snippet">
          {/* eslint-disable-next-line react/no-danger */}
          <span dangerouslySetInnerHTML={{ __html: snippet }} />
          <span className={`match-field ${matchField}`}>{matchField}</span>
        </div>
      )}
    </div>
  );
}
