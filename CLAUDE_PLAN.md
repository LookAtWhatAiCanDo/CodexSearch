# CodexSearch: Search All OpenAI Codex Desktop Chat Sessions

## Context

OpenAI Codex desktop app has no search for archived chats — they're buried in Settings with no search capability ([issue #20732](https://github.com/openai/codex/issues/20732)). All session data is accessible as local JSONL files. This project builds a CLI + local web app that searches all sessions, making it easy to share publicly so OpenAI can see the demand.

## Data Source (confirmed on this Mac)

- **Active sessions**: `~/.codex/sessions/YYYY/MM/DD/rollout-{ts}-{uuid}.jsonl` — 225 files
- **Archived sessions**: `~/.codex/archived_sessions/rollout-{ts}-{uuid}.jsonl` — 24 files (flat dir)
- **Session index**: `~/.codex/session_index.jsonl` — `{id, thread_name, updated_at}` for ~40 sessions only
- **JSONL event types of interest**:
  - `session_meta` (line 1) — id, timestamp, cwd, modelProvider
  - `event_msg` type `user_message` — `payload.message` (user's text)
  - `event_msg` type `agent_message` — `payload.message`, `payload.phase` ("final_answer")
  - `event_msg` type `task_complete` — `payload.last_agent_message`
  - Skip `response_item` lines (system context noise)

## Project Structure

```
CodexSearch/
├── package.json                  # npm workspaces root (private)
├── tsconfig.base.json
├── .gitignore
├── README.md
└── packages/
    ├── core/                     # shared parsing + search logic (no deps)
    │   └── src/
    │       ├── types.ts          # all TypeScript interfaces
    │       ├── finder.ts         # locate all JSONL files
    │       ├── parser.ts         # parse single JSONL → Session
    │       ├── index-builder.ts  # build in-memory SearchIndex
    │       └── index.ts          # search() function + re-exports
    ├── server/                   # Express API (deps: express, cors, chokidar)
    │   └── src/
    │       ├── index.ts          # startup, chokidar watcher, listen
    │       ├── server.ts         # Express app factory
    │       └── routes/
    │           ├── search.ts     # GET /api/search?q=&limit=
    │           └── sessions.ts   # GET /api/sessions, GET /api/sessions/:id
    ├── web/                      # React + Vite frontend
    │   ├── vite.config.ts        # proxy /api → localhost:3001
    │   └── src/
    │       ├── App.tsx
    │       ├── hooks/useSearch.ts
    │       └── components/
    │           ├── SearchBar.tsx
    │           ├── ResultList.tsx
    │           ├── ResultCard.tsx
    │           ├── ArchivedBadge.tsx
    │           └── SessionDetail.tsx
    └── cli/                      # published to npm as "codex-search"
        ├── package.json          # bin: { "codex-search": "./dist/cli.js" }
        └── src/cli.ts            # commander CLI
```

## Key TypeScript Interfaces (`packages/core/src/types.ts`)

```typescript
interface Session {
  id: string; filePath: string; isArchived: boolean;
  timestamp: string; updatedAt: string; cwd: string;
  cliVersion: string; modelProvider: string; threadName: string;
  turns: Turn[];
}
interface Turn {
  turnId: string; userMessage: string;
  finalAnswer: string; lastAgentMessage: string;
}
interface SearchableChunk {
  sessionId: string; turnId: string;
  userMessage: string; agentSummary: string;
}
interface SearchIndex {
  sessions: Map<string, Session>; chunks: SearchableChunk[];
  builtAt: Date; sessionCount: number;
}
interface SearchResult {
  session: SessionSummary; turnId: string;
  matchField: 'user' | 'agent'; snippet: string; score: number;
}
interface SessionSummary {
  id: string; threadName: string; cwd: string;
  timestamp: string; updatedAt: string; isArchived: boolean;
  modelProvider: string; turnCount: number; filePath: string;
}
```

## API Routes

```
GET /api/search?q=<string>&limit=<number=50>  → SearchResponse
GET /api/sessions                              → SessionSummary[]
GET /api/sessions/:id                          → Session
GET /api/status                                → { sessionCount, indexAge, builtAt }
```

## CLI Command

```
codex-search [query]          # search + print results, then exit
codex-search --web            # start server + open browser UI
codex-search                  # (no args) same as --web
Options: -n/--limit, -j/--json, -w/--web, -p/--port, --no-color
```

## npm Scripts

```json
"dev":          "concurrently 'tsx watch packages/server/src/index.ts' 'vite packages/web'",
"build:publish":"build core → build web → cp web/dist → cli/public → esbuild bundle cli",
"start":        "node packages/cli/dist/cli.js --web"
```

## Implementation Order

1. `packages/core` — types → finder → parser → index-builder → search (pure Node.js, test with `tsx`)
2. `packages/server` — Express server + all API routes (test with curl)
3. `packages/web` — Vite scaffold → useSearch hook → ResultCard → ResultList → SearchBar → App → SessionDetail
4. `packages/cli` — commander setup → query mode (build index, search, print, exit) → `--web` mode (start server, open browser)
5. Polish — ArchivedBadge, keyboard nav (`/` focuses, `Esc` clears, arrows navigate), chokidar live reload, esbuild bundle for npx

## Thread Name Derivation (important edge case)

`session_index.jsonl` only covers 40/249 sessions. Priority:
1. Match `id` in `session_index.jsonl` → use `thread_name`
2. Else use first 80 chars of `turns[0].userMessage`
3. Else use `"Session ${timestamp}"` from filename

## Verified Local Data

- 249 total sessions (225 active + 24 archived)
- In-memory index builds in ~0.46s — no database needed
- Archived sessions are flat in `~/.codex/archived_sessions/` (not date-organized)
- CODEX_DIR env var allows override for testing

## README.md

The README must clearly present the problem and make the case for the tool. Structure:

```markdown
# CodexSearch

> Search all your OpenAI Codex desktop app chat sessions — including archived ones.

## The Problem

OpenAI Codex desktop stores all your AI coding sessions, but finding a past conversation is
frustrating by design:

- **Search ignores archived chats** — the main search bar only covers active sessions
- **Archived chats are hidden in Settings** — not visible in the normal chat list
- **No search in the archive** — Settings shows a flat list with no search capability

This is tracked in [openai/codex#20732](https://github.com/openai/codex/issues/20732).
CodexSearch is a stopgap until OpenAI fixes this natively — and a demonstration of how
useful and used that fix would be.

## What It Does

Reads Codex session files directly from `~/.codex/` and gives you:

- **Web UI** — full-text search across all sessions with highlighted snippets, archived badge,
  conversation preview, filterable by archived/active
- **CLI** — `codex-search "query"` prints matching sessions instantly in the terminal

Both archived and active sessions are searched. Archived sessions are clearly labeled.

## Quick Start

### Web UI
npx codex-search
# Opens http://localhost:3001 in your browser

### CLI
npx codex-search "firebase auth"

## How It Works

Codex stores every session as a JSONL file...
[explain ~/.codex/sessions and ~/.codex/archived_sessions]

## Contributing / Feedback

If this is useful to you, please 👍 [openai/codex#20732](https://github.com/openai/codex/issues/20732)
to help OpenAI prioritize a native fix.
```

Tone: factual, shows the problem clearly, credits the upstream issue, invites engagement.

## Verification

```bash
# 1. Start dev mode
npm run dev
# → Open http://localhost:5173, search "firebase", verify archived badge appears

# 2. Test CLI search mode
npx tsx packages/cli/src/cli.ts "firebase"
# → Should print ≥1 result from ~/.codex/sessions or archived_sessions

# 3. Test API directly
curl "http://localhost:3001/api/search?q=firebase" | jq '.totalResults'
curl "http://localhost:3001/api/status" | jq '.'

# 4. Test --web launch
npx tsx packages/cli/src/cli.ts --web
# → Browser opens at http://localhost:3001
```
