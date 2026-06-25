# CodexSearch

> Search all your OpenAI Codex desktop app chat sessions — including archived ones.

## The Problem

OpenAI Codex desktop stores every AI coding session you've had, but finding a past conversation is frustrating by design:

- **Search ignores archived chats** — the main search bar only covers active sessions
- **Archived chats are hidden in Settings** — they're not visible in the normal chat list at all
- **No search in the archive** — Settings shows a flat list with zero search capability

Related upstream issues:

- [openai/codex#20732](https://github.com/openai/codex/issues/20732) — show archived chats in the normal list
- [openai/codex#12963](https://github.com/openai/codex/issues/12963) — search across sessions
- [All open search + archived issues](https://github.com/openai/codex/issues?q=is%3Aissue%20sort%3Aupdated-desc%20search%20archived)

CodexSearch is a stopgap until OpenAI fixes this natively — and a live demonstration of how useful and actively wanted that fix would be.

## What It Does

Reads Codex session files directly from `~/.codex/` and gives you two ways to search:

**Web UI** — full-text search with highlighted snippets, archived badges, conversation preview, and filter tabs (All / Archived only / Active only):

```
npx codex-search
```

Opens `http://localhost:3001` in your browser automatically.

**CLI** — instant terminal search, pipe-friendly JSON output:

```
npx codex-search "firebase auth"
npx codex-search --archived-only "sqlite migration"
npx codex-search -j "query" | jq '.results[].session.threadName'
```

Both archived and active sessions are searched. Archived sessions are clearly labeled `[ARCHIVED]`.

## How It Works

Codex stores every session as a [JSONL](https://jsonlines.org/) file under `~/.codex/`:

```
~/.codex/
├── sessions/YYYY/MM/DD/rollout-{ts}-{uuid}.jsonl   ← active sessions
└── archived_sessions/rollout-{ts}-{uuid}.jsonl     ← archived sessions
```

Each file is a stream of events. CodexSearch reads them all at startup (~0.5s for 250 sessions), builds an in-memory index of user messages and agent replies, and serves a search API on `localhost:3001`. The index auto-rebuilds as new sessions are written.

Thread names come from `~/.codex/session_index.jsonl` when available, or are derived from the first user message in the session.

## Download

Pre-built installers are on the [Releases page](https://github.com/LookAtWhatAiCanDo/CodexSearch/releases):

**macOS (Apple Silicon):** `CodexSearch-x.x.x-arm64.dmg`
1. Open the DMG and drag CodexSearch to Applications
2. Run this once in Terminal — the app is unsigned and macOS will otherwise block it:
   ```bash
   xattr -cr /Applications/CodexSearch.app
   ```
3. Double-click CodexSearch in Applications to launch

**macOS (Intel):** same steps, use `CodexSearch-x.x.x.dmg`

**Windows:** run `CodexSearch-Setup-x.x.x.exe`

**Linux:** run `CodexSearch-x.x.x-x86_64.AppImage` (chmod +x first) or install the `-amd64.deb`

The app checks for updates automatically on launch and prompts you (with release notes) when a new version is available.

## Install via npm

```bash
# Run directly without installing
npx codex-search

# Or install globally
npm install -g codex-search
codex-search "query"
```

## CLI Usage

```
codex-search [query] [options]

Arguments:
  query                 Search query (omit to open web UI)

Options:
  -n, --limit <number>  Max results (default: 20)
  -j, --json            Output raw JSON
  -w, --web             Open the web UI
  -p, --port <number>   Web server port (default: 3001)
  --archived-only       Search archived sessions only
  --active-only         Search active sessions only
  --no-color            Disable colored output
  -V, --version         Show version
  -h, --help            Show help
```

## Development

```bash
git clone https://github.com/LookAtWhatAiCanDo/CodexSearch
cd CodexSearch
npm install
npm run dev        # Express on :3001 + Vite on :5173 (hot-reload)
```

Open `http://localhost:5173` for the hot-reloading dev UI.

### Building installers locally

All commands run from the repo root:

```bash
# Build + package for the current platform
npm run desktop

# Or target a specific platform explicitly:
npm run desktop:mac    # → .dmg + .zip (macOS only; must run on a Mac)
npm run desktop:win    # → .exe NSIS installer
npm run desktop:linux  # → .AppImage + .deb
```

Output lands in **`packages/desktop/dist-electron/`**, for example:

```
packages/desktop/dist-electron/CodexSearch-1.0.0-arm64.dmg   ← Apple Silicon
packages/desktop/dist-electron/CodexSearch-1.0.0.dmg         ← Intel
```

Open it: `open packages/desktop/dist-electron/CodexSearch-1.0.0-arm64.dmg`

The `desktop` script handles everything in order: TypeScript compilation of all packages → Vite production build of the web UI → electron-builder packaging.

### Regenerating icons

If you change `packages/desktop/assets/icon.svg`, regenerate all platform formats:

```bash
npm run icons   # → icon.png (1024×1024), icon.icns (macOS), icon.ico (Windows)
```

Requires `iconutil` (built into macOS). The generated files are committed to the repo so CI doesn't need to regenerate them.

## Data Privacy

CodexSearch runs **entirely locally**. It reads `~/.codex/` on your machine and serves a local HTTP API on `localhost`. No data leaves your computer.

## If This Is Useful to You

Please 👍 the upstream issues to help OpenAI prioritize a native fix:

- [openai/codex#20732](https://github.com/openai/codex/issues/20732)
- [openai/codex#12963](https://github.com/openai/codex/issues/12963)

The more signal they see, the sooner archived chat search lands in Codex itself.

## Meta

This utility was initially written using [Anthropic Claude Code](https://claude.ai/code) — an AI coding assistant from Anthropic, OpenAI's main competitor. The irony is noted and appreciated. Just another brick in the [LookAtWhatAiCanDo](https://github.com/LookAtWhatAiCanDo) wall.

---

## Footnote: The Bigger Idea

Once you have search working for Codex sessions, the obvious next question is: why stop there? Every AI coding assistant stores session data locally in some format. Jumping between Codex, Claude Code, Cursor, Aider, Copilot, and Gemini to find a conversation you had three weeks ago is the same frustrating problem, just multiplied.

The logical evolution is a gestalt aggregator — a single app that indexes and searches sessions across *all* local AI coding assistants. Call it **Codeoba**, or something else. The architecture is the same: find the local storage, parse the format, feed a common index. The value compounds with every tool you add.

This space just started heating up. All of the following launched in the last year, suggesting the problem is real and the timing is now:

| Project | Focus | First commit |
|---|---|---|
| [ccmanager](https://github.com/kbwo/ccmanager) | Multi-tool session manager (Claude Code, Cursor, Copilot CLI, Gemini, Codex, Cline…) | [Jun 5, 2025](https://github.com/kbwo/ccmanager/commit/1b3f94bbbea32e68e084dd4a697a0642d961c6b3) |
| [agent-sessions](https://github.com/jazzyalex/agent-sessions) | macOS GUI: browse + search sessions across 7+ tools | [Sep 10, 2025](https://github.com/jazzyalex/agent-sessions/commit/122f9b9a5a2395ff21189f1e5fe874e61955d6ac) |
| [CASS](https://github.com/Dicklesworthstone/coding_agent_session_search) | CLI/TUI: lexical + semantic search across 11+ providers | [Nov 20, 2025](https://github.com/Dicklesworthstone/coding_agent_session_search/commit/2cf22a19271f80bacc02abc34d34eb52e52df6f9) |
| [lore](https://github.com/varalys/lore) | Sessions linked to git commits, full-text search, MCP server | [Dec 22, 2025](https://github.com/varalys/lore/commit/579e36f4a389a257d20d4286c78dea815f9a62d4) |
| [session-graph](https://github.com/robertoshimizu/session-graph) | Sessions as a W3C knowledge graph (SPARQL queryable) | [Feb 14, 2026](https://github.com/robertoshimizu/session-graph/commit/763675a708f2ba6b4ce60521b8049154602046ad) |
| [Claudoscope](https://github.com/cordwainersmith/Claudoscope) | macOS menu-bar app, Claude Code-specific | [Mar 14, 2026](https://github.com/cordwainersmith/Claudoscope/commit/0a00a8f9cf30e8314266990a537bb0345476dbdf) |

None of these has become the definitive cross-platform, cross-tool, polished solution. The space is active but not yet won. CodexSearch is a starting point — and a proof of concept that the data is right there, readable, and indexable without any API keys or cloud dependencies.

Pro tier ideas that would make this genuinely powerful: natural language queries via an embedded LLM, semantic similarity search, automatic tagging by project/repo, and cross-session "what was I working on last week?" summaries.
