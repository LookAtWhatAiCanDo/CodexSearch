export { createApp } from './server.js';

// Run as standalone server when executed directly
if (require.main === module) {
  const path = require('path') as typeof import('path');
  const chokidar = require('chokidar') as typeof import('chokidar');
  const { buildIndex, getCodexDir } = require('@codex-search/core') as typeof import('@codex-search/core');

  const PORT = parseInt(process.env.PORT ?? '3001', 10);
  const CODEX_DIR = getCodexDir();

  let currentIndex = buildIndex(CODEX_DIR);
  console.log(`[CodexSearch] Indexed ${currentIndex.sessionCount} sessions from ${CODEX_DIR}`);

  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRebuild = () => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      currentIndex = buildIndex(CODEX_DIR);
      console.log(`[CodexSearch] Index updated: ${currentIndex.sessionCount} sessions`);
    }, 1000);
  };

  chokidar.watch([
    path.join(CODEX_DIR, 'sessions'),
    path.join(CODEX_DIR, 'archived_sessions'),
    path.join(CODEX_DIR, 'session_index.jsonl'),
  ], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  }).on('add', scheduleRebuild).on('change', scheduleRebuild);

  const { createApp } = require('./server.js') as typeof import('./server.js');
  const app = createApp(() => currentIndex);

  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`[CodexSearch] Server running at ${url}`);
    if (process.env.OPEN_BROWSER === '1') {
      import('open').then(({ default: open }) => open(url)).catch(() => {});
    }
  });
}
