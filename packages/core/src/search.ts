import type { SearchIndex, SearchResult, SessionSummary } from './types.js';

function toSummary(session: import('./types.js').Session): SessionSummary {
  return {
    id: session.id,
    threadName: session.threadName,
    cwd: session.cwd,
    timestamp: session.timestamp,
    updatedAt: session.updatedAt,
    isArchived: session.isArchived,
    modelProvider: session.modelProvider,
    turnCount: session.turns.length,
    filePath: session.filePath,
  };
}

function makeSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let bestPos = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (bestPos === -1 || idx < bestPos)) bestPos = idx;
  }
  const start = Math.max(0, bestPos - 75);
  const end = Math.min(text.length, bestPos + 75);
  let snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');

  // Wrap matched terms with <mark>
  for (const term of terms) {
    snippet = snippet.replace(new RegExp(escapeRegex(term), 'gi'), m => `<mark>${m}</mark>`);
  }
  return snippet;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface SearchOptions {
  limit?: number;
  onlyArchived?: boolean;
  onlyActive?: boolean;
}

export function search(
  index: SearchIndex,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const { limit = 50, onlyArchived = false, onlyActive = false } = options;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    // No query: return all sessions sorted by updatedAt
    const all: SearchResult[] = [];
    for (const session of index.sessions.values()) {
      if (onlyArchived && !session.isArchived) continue;
      if (onlyActive && session.isArchived) continue;
      all.push({
        session: toSummary(session),
        turnId: session.turns[0]?.turnId ?? '',
        matchField: 'user',
        snippet: session.turns[0]?.userMessage?.slice(0, 150) ?? '',
        score: 0,
      });
    }
    all.sort((a, b) => b.session.updatedAt.localeCompare(a.session.updatedAt));
    return all.slice(0, limit);
  }

  const results: SearchResult[] = [];

  // First pass: match on thread name (score bump)
  for (const session of index.sessions.values()) {
    if (onlyArchived && !session.isArchived) continue;
    if (onlyActive && session.isArchived) continue;

    const threadLower = session.threadName.toLowerCase();
    const score = terms.filter(t => threadLower.includes(t)).length;
    if (score > 0) {
      results.push({
        session: toSummary(session),
        turnId: session.turns[0]?.turnId ?? '',
        matchField: 'thread',
        snippet: makeSnippet(session.threadName, terms),
        score: score * 2, // thread matches rank higher
      });
    }
  }

  // Second pass: match on turn content
  const alreadyMatchedByThread = new Set(results.map(r => r.session.id));

  for (const chunk of index.chunks) {
    const session = index.sessions.get(chunk.sessionId);
    if (!session) continue;
    if (onlyArchived && !session.isArchived) continue;
    if (onlyActive && session.isArchived) continue;

    const userLower = chunk.userMessage.toLowerCase();
    const agentLower = chunk.agentSummary.toLowerCase();

    const userScore = terms.filter(t => userLower.includes(t)).length;
    const agentScore = terms.filter(t => agentLower.includes(t)).length;

    if (userScore === 0 && agentScore === 0) continue;

    // If already matched by thread name, boost that result's score instead
    if (alreadyMatchedByThread.has(chunk.sessionId)) {
      const existing = results.find(r => r.session.id === chunk.sessionId);
      if (existing) {
        existing.score += Math.max(userScore, agentScore);
        continue;
      }
    }

    const matchField = userScore >= agentScore ? 'user' : 'agent';
    const matchText = matchField === 'user' ? chunk.userMessage : chunk.agentSummary;
    const score = Math.max(userScore, agentScore);

    results.push({
      session: toSummary(session),
      turnId: chunk.turnId,
      matchField,
      snippet: makeSnippet(matchText, terms),
      score,
    });
  }

  // Sort: score desc, then updatedAt desc
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.session.updatedAt.localeCompare(a.session.updatedAt);
  });

  // Deduplicate: one result per session (keep highest score)
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const r of results) {
    if (!seen.has(r.session.id)) {
      seen.add(r.session.id);
      deduped.push(r);
    }
  }

  return deduped.slice(0, limit);
}
