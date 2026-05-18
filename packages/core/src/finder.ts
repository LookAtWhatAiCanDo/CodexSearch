import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionFile {
  path: string;
  isArchived: boolean;
  mtime: Date;
}

export function getCodexDir(): string {
  return process.env.CODEX_DIR ?? path.join(os.homedir(), '.codex');
}

function walkDir(dir: string, results: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(full);
    }
  }
}

export function findSessionFiles(codexDir?: string): SessionFile[] {
  const root = codexDir ?? getCodexDir();
  const activeDir = path.join(root, 'sessions');
  const archivedDir = path.join(root, 'archived_sessions');

  const activePaths: string[] = [];
  const archivedPaths: string[] = [];
  walkDir(activeDir, activePaths);
  walkDir(archivedDir, archivedPaths);

  const toSessionFile = (p: string, isArchived: boolean): SessionFile => ({
    path: p,
    isArchived,
    mtime: fs.statSync(p).mtime,
  });

  const files: SessionFile[] = [
    ...activePaths.map(p => toSessionFile(p, false)),
    ...archivedPaths.map(p => toSessionFile(p, true)),
  ];

  // Newest first
  files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return files;
}

export function getSessionIndexPath(codexDir?: string): string {
  return path.join(codexDir ?? getCodexDir(), 'session_index.jsonl');
}
