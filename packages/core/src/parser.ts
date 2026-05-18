import * as fs from 'fs';
import type { SessionFile } from './finder.js';
import type { Session, Turn } from './types.js';

interface SessionMeta {
  id: string;
  timestamp: string;
  cwd: string;
  cli_version?: string;
  model_provider?: string;
}

interface EventMsg {
  type: string;
  turn_id?: string;
  message?: string;
  phase?: string;
  last_agent_message?: string | null;
}

// Extract UUID from filename: rollout-{ts}-{uuid}.jsonl
function extractIdFromPath(filePath: string): string | null {
  const m = filePath.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
  return m ? m[1] : null;
}

export function parseSessionFile(file: SessionFile): Session | null {
  let raw: string;
  try {
    raw = fs.readFileSync(file.path, 'utf8');
  } catch {
    return null;
  }

  const lines = raw.split('\n');
  let meta: SessionMeta | null = null;
  const turns = new Map<string, Partial<Turn>>();
  let currentTurnId: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = obj.type as string | undefined;
    const payload = obj.payload as Record<string, unknown> | undefined;

    if (type === 'session_meta' && payload) {
      meta = payload as unknown as SessionMeta;
      continue;
    }

    // Skip raw LLM context noise
    if (type === 'response_item') continue;

    if (type === 'turn_context' && payload) {
      currentTurnId = (payload.turn_id as string) ?? currentTurnId;
      continue;
    }

    if (type === 'event_msg' && payload) {
      const evType = payload.type as string | undefined;
      const msg = payload as unknown as EventMsg;

      if (evType === 'task_started') {
        currentTurnId = msg.turn_id ?? currentTurnId;
        if (currentTurnId && !turns.has(currentTurnId)) {
          turns.set(currentTurnId, { turnId: currentTurnId, userMessage: '', finalAnswer: '', lastAgentMessage: '' });
        }
        continue;
      }

      if (evType === 'user_message' && msg.message !== undefined) {
        const tid = currentTurnId ?? 'default';
        if (!turns.has(tid)) turns.set(tid, { turnId: tid, userMessage: '', finalAnswer: '', lastAgentMessage: '' });
        const turn = turns.get(tid)!;
        turn.userMessage = msg.message ?? '';
        continue;
      }

      if (evType === 'agent_message' && msg.phase === 'final_answer' && msg.message !== undefined) {
        const tid = currentTurnId ?? 'default';
        if (!turns.has(tid)) turns.set(tid, { turnId: tid, userMessage: '', finalAnswer: '', lastAgentMessage: '' });
        const turn = turns.get(tid)!;
        turn.finalAnswer = msg.message ?? '';
        continue;
      }

      if (evType === 'task_complete') {
        const tid = msg.turn_id ?? currentTurnId ?? 'default';
        if (!turns.has(tid)) turns.set(tid, { turnId: tid, userMessage: '', finalAnswer: '', lastAgentMessage: '' });
        const turn = turns.get(tid)!;
        turn.lastAgentMessage = (msg.last_agent_message as string | null) ?? '';
        continue;
      }
    }
  }

  if (!meta) {
    // Try to recover id from filename
    const id = extractIdFromPath(file.path);
    if (!id) return null;
    meta = { id, timestamp: file.mtime.toISOString(), cwd: '' };
  }

  const completeTurns: Turn[] = [];
  for (const [, partial] of turns) {
    completeTurns.push({
      turnId: partial.turnId ?? '',
      userMessage: partial.userMessage ?? '',
      finalAnswer: partial.finalAnswer ?? '',
      lastAgentMessage: partial.lastAgentMessage ?? '',
    });
  }

  return {
    id: meta.id,
    filePath: file.path,
    isArchived: file.isArchived,
    timestamp: meta.timestamp,
    updatedAt: file.mtime.toISOString(),
    cwd: meta.cwd ?? '',
    cliVersion: meta.cli_version ?? '',
    modelProvider: meta.model_provider ?? '',
    threadName: '', // resolved in index-builder
    turns: completeTurns,
  };
}
