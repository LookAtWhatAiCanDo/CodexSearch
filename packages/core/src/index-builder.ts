import * as fs from 'fs';
import * as path from 'path';
import { findSessionFiles, getCodexDir, getSessionIndexPath } from './finder.js';
import { parseSessionFile } from './parser.js';
import type { SearchIndex, SearchableChunk } from './types.js';

interface IndexEntry {
  thread_name: string;
  updated_at: string;
}

function loadSessionIndex(indexPath: string): Map<string, IndexEntry> {
  const map = new Map<string, IndexEntry>();
  if (!fs.existsSync(indexPath)) return map;
  try {
    const lines = fs.readFileSync(indexPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as { id: string; thread_name: string; updated_at: string };
        if (obj.id) map.set(obj.id, { thread_name: obj.thread_name, updated_at: obj.updated_at });
      } catch { /* skip malformed line */ }
    }
  } catch { /* file unreadable */ }
  return map;
}

function deriveThreadName(firstUserMessage: string, filePath: string): string {
  if (firstUserMessage) {
    const oneLine = firstUserMessage.replace(/\s+/g, ' ').trim();
    return oneLine.length > 80 ? oneLine.slice(0, 80) + '…' : oneLine;
  }
  // Fallback to timestamp from filename
  const base = path.basename(filePath, '.jsonl');
  const m = base.match(/rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  return m ? `Session ${m[1].replace('T', ' ').replace(/-/g, ':')}` : base;
}

export function buildIndex(codexDir?: string): SearchIndex {
  const root = codexDir ?? getCodexDir();
  const indexPath = getSessionIndexPath(root);
  const sessionIndex = loadSessionIndex(indexPath);
  const files = findSessionFiles(root);

  const sessions = new Map<string, import('./types.js').Session>();
  const chunks: SearchableChunk[] = [];

  for (const file of files) {
    const session = parseSessionFile(file);
    if (!session) continue;

    // Resolve thread name
    const indexEntry = sessionIndex.get(session.id);
    if (indexEntry?.thread_name) {
      session.threadName = indexEntry.thread_name;
      // Use index's updatedAt if it's available (more accurate)
      if (indexEntry.updated_at) session.updatedAt = indexEntry.updated_at;
    } else {
      const firstUserMsg = session.turns.find(t => t.userMessage)?.userMessage ?? '';
      session.threadName = deriveThreadName(firstUserMsg, file.path);
    }

    sessions.set(session.id, session);

    for (const turn of session.turns) {
      const agentSummary = turn.finalAnswer || turn.lastAgentMessage;
      if (turn.userMessage || agentSummary) {
        chunks.push({
          sessionId: session.id,
          turnId: turn.turnId,
          userMessage: turn.userMessage,
          agentSummary,
        });
      }
    }

    // Always index thread name as a searchable chunk (even if no turns)
    if (session.turns.length === 0) {
      chunks.push({
        sessionId: session.id,
        turnId: '',
        userMessage: '',
        agentSummary: '',
      });
    }
  }

  return {
    sessions,
    chunks,
    builtAt: new Date(),
    sessionCount: sessions.size,
  };
}
