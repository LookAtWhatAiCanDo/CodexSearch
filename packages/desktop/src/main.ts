import { app, BrowserWindow, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import chokidar from 'chokidar';
import { buildIndex, getCodexDir } from '@codex-search/core';
import type { SearchIndex } from '@codex-search/core';
import { createApp } from '@codex-search/server';
import type { UpdateInfo } from 'electron-updater';

const PORT = 3001;
const isDev = !app.isPackaged;

// ── Single instance lock ──────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ── Express server ────────────────────────────────────────────────────────────

let currentIndex: SearchIndex;
let server: http.Server | null = null;

function startServer(): void {
  const codexDir = getCodexDir();
  currentIndex = buildIndex(codexDir);
  console.log(`[CodexSearch] Indexed ${currentIndex.sessionCount} sessions`);

  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRebuild = () => {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      currentIndex = buildIndex(codexDir);
      console.log(`[CodexSearch] Index rebuilt: ${currentIndex.sessionCount} sessions`);
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

  const expressApp = createApp(() => currentIndex);

  // Serve built web assets (packaged alongside the app)
  const webDist = isDev
    ? path.join(__dirname, '..', '..', '..', 'web', 'dist')
    : path.join(process.resourcesPath, 'web', 'dist');

  if (fs.existsSync(webDist)) {
    const express = require('express') as typeof import('express');
    expressApp.use(express.static(webDist));
    expressApp.get('*', (_req: import('express').Request, res: import('express').Response) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    console.warn(`[CodexSearch] Web dist not found at ${webDist}`);
  }

  server = expressApp.listen(PORT, () => {
    console.log(`[CodexSearch] Server listening on http://localhost:${PORT}`);
  });
}

// ── BrowserWindow ─────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: 'CodexSearch',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Open external links in the system browser, not in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  if (isDev) return; // Don't check for updates in dev mode

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info: UpdateInfo) => {
    const releaseNotes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes.replace(/<[^>]+>/g, '').trim()
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map(n => n.note ?? '').join('\n').trim()
        : '';

    const message = [
      `Version ${info.version} is available (you have ${app.getVersion()}).`,
      '',
      releaseNotes ? `What's new:\n${releaseNotes.slice(0, 600)}` : '',
    ].filter(Boolean).join('\n');

    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Available',
      message: `CodexSearch ${info.version} is available`,
      detail: message,
      buttons: ['Download & Install', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded',
      detail: 'CodexSearch will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[CodexSearch] Auto-update error:', err.message);
  });

  // Check silently — only shows a dialog if an update is found
  autoUpdater.checkForUpdates().catch((err: Error) => {
    console.error('[CodexSearch] Update check failed:', err.message);
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startServer();

  // Wait briefly for the server to be ready before loading the window
  setTimeout(() => {
    createWindow();
    setupAutoUpdater();
  }, 500);

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  server?.close();
});
