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

## Electron Desktop App (`packages/desktop/`)

### Why Electron
Zero migration cost — the Node.js Express server runs natively in the Electron main process. `electron-updater` provides battle-tested GitHub Releases auto-update with release notes on all three platforms.

### New workspace: `packages/desktop/`

```
packages/desktop/
├── package.json           # electron, electron-builder, electron-updater
├── electron-builder.yml   # platform targets + publish config
├── tsconfig.json
├── assets/
│   └── icon.png           # 512×512, used for all platforms
└── src/
    ├── main.ts            # Electron main process
    └── preload.ts         # contextBridge (minimal — no node in renderer)
```

### `src/main.ts` — main process responsibilities

1. **Start the Express server** from `@codex-search/server` on port 3001 (same code as CLI `--web` mode, reused directly)
2. **Create BrowserWindow** loading `http://localhost:3001` (works in both dev and prod since Express serves the static web build)
3. **Check for updates** on app ready via `electron-updater` — fetches GitHub Releases, shows dialog with release notes, downloads in background, prompts restart
4. **Single-instance lock** — `app.requestSingleInstanceLock()` so double-clicking the icon focuses the existing window

### `electron-builder.yml`

```yaml
appId: com.lookatwhataiCando.codexsearch
productName: CodexSearch
directories:
  output: dist-electron
files:
  - packages/desktop/dist/**
  - packages/server/dist/**
  - packages/core/dist/**
  - packages/web/dist/**
  - node_modules/**
extraResources:
  - from: packages/web/dist
    to: web/dist
mac:
  target: [dmg, zip]   # zip required for Mac auto-update
  category: public.app-category.developer-tools
win:
  target: nsis
linux:
  target: [AppImage, deb]
publish:
  provider: github
  owner: LookAtWhatAiCanDo
  repo: CodexSearch
```

### `package.json` key scripts

```json
"scripts": {
  "dev":   "tsx src/main.ts",           // dev: uses tsx, loads vite at :5173
  "build": "tsc",
  "dist":  "electron-builder",           // local test build
  "dist:mac":   "electron-builder --mac",
  "dist:win":   "electron-builder --win",
  "dist:linux": "electron-builder --linux"
}
```

Add to **root** `package.json`:
```json
"build:desktop": "npm run build:publish && npm run dist -w @codex-search/desktop"
```

### Auto-update flow (`electron-updater`)

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;  // ask user first

autoUpdater.on('update-available', (info) => {
  // Show dialog: version, release date, release notes (from GitHub Release body)
  // User clicks "Download & Install" → autoUpdater.downloadUpdate()
  // User clicks "Later" → dismiss
});

autoUpdater.on('update-downloaded', () => {
  // Show dialog: "Ready to install. Restart now?"
  // User clicks "Restart" → autoUpdater.quitAndInstall()
});

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();   // non-blocking
});
```

**Release notes**: `electron-updater` reads the GitHub Release body automatically and passes it as `info.releaseNotes` — display it in the update dialog.

### GitHub Actions: `.github/workflows/release.yml`

Trigger: `push` to tags matching `v*.*.*`

Matrix build — three parallel jobs:
| Runner | Output |
|---|---|
| `macos-latest` | `.dmg` + `.zip` |
| `windows-latest` | `.exe` (NSIS installer) |
| `ubuntu-latest` | `.AppImage` + `.deb` |

Each job:
1. `npm ci`
2. `npm run build:publish` (core → web → desktop)
3. `electron-builder --publish always` (builds + uploads to the GitHub Release)

The `GH_TOKEN` secret is passed to electron-builder so it can attach artifacts to the release.

### Code signing (required for seamless auto-update)

- **macOS**: Apple Developer ID cert + notarization. Set `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` in GitHub Actions secrets. electron-builder handles notarization via `afterSign` hook.
- **Windows**: Code signing cert (EV cert removes SmartScreen warning). Set `CSC_LINK`, `CSC_KEY_PASSWORD`.
- **Linux**: No signing required.

Without signing, auto-update still works on Linux and for dev/testing, but macOS Gatekeeper will block unsigned updates.

### Dev workflow changes

```bash
# Dev (existing — unchanged)
npm run dev

# Build + package locally (Mac only)
npm run build:publish
npm run dist -w @codex-search/desktop

# Release a new version
git tag v1.0.0 && git push --tags
# → GitHub Actions builds all three platforms and uploads to the release
```

### Files to create/modify

- **New**: `packages/desktop/package.json`
- **New**: `packages/desktop/tsconfig.json`
- **New**: `packages/desktop/electron-builder.yml`
- **New**: `packages/desktop/src/main.ts`
- **New**: `packages/desktop/src/preload.ts`
- **New**: `packages/desktop/assets/icon.png` (placeholder — user to replace)
- **New**: `.github/workflows/release.yml`
- **Modify**: root `package.json` — add `packages/desktop` to workspaces, add `build:desktop` script
- **Modify**: `README.md` — add "Download" section with links to GitHub Releases

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
