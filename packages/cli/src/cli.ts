import { program } from 'commander';
import { buildIndex, search, getCodexDir } from '@codex-search/core';
import type { SearchResult } from '@codex-search/core';
import { createApp } from '@codex-search/server';
import * as path from 'path';
import * as fs from 'fs';
import chokidar from 'chokidar';

program
  .name('codex-search')
  .description('Search all your OpenAI Codex desktop chat sessions, including archived ones')
  .version('1.0.0')
  .argument('[query]', 'Search query (omit to open web UI)')
  .option('-n, --limit <number>', 'Max results to show', '20')
  .option('-j, --json', 'Output raw JSON')
  .option('-w, --web', 'Open the web UI in your browser')
  .option('-p, --port <number>', 'Port for web server', '3001')
  .option('--archived-only', 'Search archived sessions only')
  .option('--active-only', 'Search active sessions only')
  .option('--no-color', 'Disable colored output');

program.parse();

const opts = program.opts<{
  limit: string;
  json: boolean;
  web: boolean;
  port: string;
  archivedOnly: boolean;
  activeOnly: boolean;
  color: boolean;
}>();

const query = program.args[0] ?? '';
const openWeb = opts.web || !query;

function dim(s: string) { return opts.color === false ? s : `\x1b[2m${s}\x1b[0m`; }
function bold(s: string) { return opts.color === false ? s : `\x1b[1m${s}\x1b[0m`; }
function yellow(s: string) { return opts.color === false ? s : `\x1b[33m${s}\x1b[0m`; }

async function runWebMode() {
  const port = parseInt(opts.port, 10) || 3001;
  const codexDir = getCodexDir();

  console.log(`Building index from ${codexDir}…`);
  let currentIndex = buildIndex(codexDir);
  console.log(`Indexed ${currentIndex.sessionCount} sessions`);

  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRebuild = () => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      currentIndex = buildIndex(codexDir);
      console.log(`Index updated: ${currentIndex.sessionCount} sessions`);
    }, 1000);
  };

  chokidar.watch([
    path.join(codexDir, 'sessions'),
    path.join(codexDir, 'archived_sessions'),
    path.join(codexDir, 'session_index.jsonl'),
  ], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  }).on('add', scheduleRebuild).on('change', scheduleRebuild);

  const app = createApp(() => currentIndex);

  // Serve built frontend from the cli package's public/ dir (populated at build time)
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    const { default: express } = await import('express');
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  const url = `http://localhost:${port}`;
  app.listen(port, () => {
    console.log(`CodexSearch running at ${url}`);
    console.log('Press Ctrl+C to stop');
  });

  try {
    const { default: open } = await import('open');
    await open(url);
  } catch {
    console.log(`Open your browser at ${url}`);
  }
}

function runCliMode() {
  const codexDir = getCodexDir();
  const index = buildIndex(codexDir);
  const limit = parseInt(opts.limit, 10) || 20;

  const results = search(index, query, {
    limit,
    onlyArchived: opts.archivedOnly,
    onlyActive: opts.activeOnly,
  });

  if (opts.json) {
    process.stdout.write(JSON.stringify(
      { query, results, totalResults: results.length, sessionCount: index.sessionCount },
      null, 2
    ) + '\n');
    return;
  }

  if (!results.length) {
    console.log(dim(`No results for "${query}" across ${index.sessionCount} sessions`));
    return;
  }

  console.log(dim(`Found ${results.length} result${results.length !== 1 ? 's' : ''} across ${index.sessionCount} sessions\n`));

  for (let i = 0; i < results.length; i++) {
    const r: SearchResult = results[i];
    const s = r.session;
    const date = new Date(s.updatedAt).toLocaleDateString();
    const cwd = s.cwd.replace(/^\/Users\/[^/]+/, '~');
    const archivedTag = s.isArchived ? yellow(' [ARCHIVED]') : '';
    const snippet = r.snippet.replace(/<\/?mark>/g, '').slice(0, 200);

    console.log(`${bold(`${i + 1}.`)}${archivedTag} ${bold(s.threadName || 'Untitled session')}`);
    if (cwd || date) console.log(`   ${dim(cwd ? `${cwd}  ·  ${date}` : date)}`);
    if (snippet) console.log(`   ${dim(snippet)}`);
    console.log(`   ${dim('─'.repeat(48))}`);
  }
}

if (openWeb) {
  runWebMode().catch(err => { console.error('Error:', err); process.exit(1); });
} else {
  try {
    runCliMode();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
