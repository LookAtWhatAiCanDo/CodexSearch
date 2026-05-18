import { useState, useEffect } from 'react';
import { ArchivedBadge } from './ArchivedBadge.tsx';
import type { Session } from '../types.ts';

interface Props {
  sessionId: string;
  onClose: () => void;
}

export function SessionDetail({ sessionId, onClose }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSession(null);
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then((data: { session: Session }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  const shortCwd = session?.cwd.replace(/^\/Users\/[^/]+/, '~') ?? '';
  const date = session
    ? new Date(session.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <div className="detail-pane">
      <button className="close-detail" onClick={onClose} title="Close">×</button>
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
      {!loading && !session && <p style={{ color: 'var(--text-muted)' }}>Session not found.</p>}
      {session && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2>{session.threadName || 'Untitled session'}</h2>
            {session.isArchived && <ArchivedBadge />}
          </div>
          <div className="detail-meta">
            {date}{shortCwd ? ` · ${shortCwd}` : ''}{session.modelProvider ? ` · ${session.modelProvider}` : ''}
          </div>
          {session.turns.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No conversation turns recorded.</p>
          )}
          {session.turns.map((turn, i) => {
            const agentText = turn.finalAnswer || turn.lastAgentMessage;
            return (
              <div key={turn.turnId || i} className="turn">
                {turn.userMessage && (
                  <div className="bubble bubble-user">
                    <div className="bubble-label">You</div>
                    {turn.userMessage}
                  </div>
                )}
                {agentText && (
                  <div className="bubble bubble-agent">
                    <div className="bubble-label">Codex</div>
                    {agentText.slice(0, 2000)}{agentText.length > 2000 ? '…' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
