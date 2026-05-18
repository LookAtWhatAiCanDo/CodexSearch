import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { search } from '@codex-search/core';
import type { SearchIndex, SearchResponse, StatusResponse } from '@codex-search/core';

export function createApp(getIndex: () => SearchIndex): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // GET /api/search?q=&limit=&filter=all|archived|active
  app.get('/api/search', (req, res) => {
    const index = getIndex();
    const q = (req.query.q as string) ?? '';
    const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10) || 50, 200);
    const filter = (req.query.filter as string) ?? 'all';

    const results = search(index, q, {
      limit,
      onlyArchived: filter === 'archived',
      onlyActive: filter === 'active',
    });

    const response: SearchResponse = {
      query: q,
      results,
      totalResults: results.length,
      sessionCount: index.sessionCount,
      indexAge: Date.now() - index.builtAt.getTime(),
    };
    res.json(response);
  });

  // GET /api/sessions — list all summaries
  app.get('/api/sessions', (req, res) => {
    const index = getIndex();
    const filter = (req.query.filter as string) ?? 'all';
    const summaries = [];
    for (const session of index.sessions.values()) {
      if (filter === 'archived' && !session.isArchived) continue;
      if (filter === 'active' && session.isArchived) continue;
      summaries.push({
        id: session.id,
        threadName: session.threadName,
        cwd: session.cwd,
        timestamp: session.timestamp,
        updatedAt: session.updatedAt,
        isArchived: session.isArchived,
        modelProvider: session.modelProvider,
        turnCount: session.turns.length,
        filePath: session.filePath,
      });
    }
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json(summaries);
  });

  // GET /api/sessions/:id — full session
  app.get('/api/sessions/:id', (req, res) => {
    const index = getIndex();
    const session = index.sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ session });
  });

  // GET /api/status
  app.get('/api/status', (req, res) => {
    const index = getIndex();
    const response: StatusResponse = {
      sessionCount: index.sessionCount,
      indexAge: Date.now() - index.builtAt.getTime(),
      builtAt: index.builtAt.toISOString(),
    };
    res.json(response);
  });

  // Serve built frontend in production
  const publicDir = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  return app;
}
