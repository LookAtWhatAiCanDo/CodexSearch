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

## Installation

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
npm run dev   # starts Express on :3001 and Vite on :5173
```

Open `http://localhost:5173` for the hot-reloading dev UI.

## Data Privacy

CodexSearch runs **entirely locally**. It reads `~/.codex/` on your machine and serves a local HTTP API on `localhost`. No data leaves your computer.

## If This Is Useful to You

Please 👍 the upstream issues to help OpenAI prioritize a native fix:

- [openai/codex#20732](https://github.com/openai/codex/issues/20732)
- [openai/codex#12963](https://github.com/openai/codex/issues/12963)

The more signal they see, the sooner archived chat search lands in Codex itself.

## Meta

This utility was initially written using [Anthropic Claude Code](https://claude.ai/code) — an AI coding assistant from Anthropic, OpenAI's main competitor. The irony is noted and appreciated. Just another brick in the [LookAtWhatAiCanDo](https://github.com/LookAtWhatAiCanDo) wall.
