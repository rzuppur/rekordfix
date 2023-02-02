import type { IpcMainInvokeEvent } from "electron";
import type { CollectionParseResult, DownloadPlaylistResult } from "./rekordbox/collection";

import { app, ipcMain } from "electron";
import "./security-restrictions";
import { restoreOrCreateWindow } from "./mainWindow";
import { collectionOpen, downloadDuplicateTracksPlaylist, downloadLostTracksPlaylist } from "./rekordbox/collection";
import { version } from "../../../package.json" assert { type: "json" };

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on("second-instance", restoreOrCreateWindow);

/**
 * Shout down background process if all windows was closed
 */
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on("activate", restoreOrCreateWindow);

/**
 * Create the application window when the background process is ready.
 */
app
  .whenReady()
  .then(restoreOrCreateWindow)
  .catch((e) => console.error("Failed create window:", e));

/**
 * Check for new version of the application - production mode only.
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() => import("electron-updater"))
    .then(({ autoUpdater }) => autoUpdater.checkForUpdatesAndNotify())
    .catch((e) => console.error("Failed check updates:", e));
}

async function handleCollectionOpen(event: IpcMainInvokeEvent): Promise<CollectionParseResult> {
  return collectionOpen(event.sender);
}

async function handleDownloadLostTracksPlaylist(event: IpcMainInvokeEvent): Promise<DownloadPlaylistResult> {
  return downloadLostTracksPlaylist(event.sender);
}

async function handleDownloadDuplicateTracksPlaylist(event: IpcMainInvokeEvent): Promise<DownloadPlaylistResult> {
  return downloadDuplicateTracksPlaylist(event.sender);
}

function handleVersion(): string {
  let packageVersion = version ?? "unknown";
  const appVersion = app.getVersion();
  if (appVersion != packageVersion) packageVersion += `, build ${appVersion}`;

  return packageVersion;
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:collectionOpen", handleCollectionOpen);
  ipcMain.handle("dialog:downloadLostTracksPlaylist", handleDownloadLostTracksPlaylist);
  ipcMain.handle("dialog:downloadDuplicateTracksPlaylist", handleDownloadDuplicateTracksPlaylist);
  ipcMain.handle("get:version", handleVersion);
});
