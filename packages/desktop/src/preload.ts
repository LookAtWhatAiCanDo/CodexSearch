import { contextBridge } from 'electron';

// Minimal preload — the renderer (React app) communicates only via HTTP to
// the Express server on localhost, so no IPC bridge is needed here.
// Expose app version so the UI can display it if desired.
contextBridge.exposeInMainWorld('codexSearch', {
  platform: process.platform,
});
