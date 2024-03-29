import type { IpcMainInvokeEvent } from "electron";

import { app, ipcMain } from "electron";
import "./security-restrictions";
import { restoreOrCreateWindow } from "./mainWindow";
import { collectionOpen, downloadDuplicateTracksPlaylist, downloadLostTracksPlaylist, downloadPlaylist, findDeletedTrackFiles, keepTrackFile, deleteTrackFile } from "./rekordbox/collection";

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
 * Shout down background process if all windows were closed
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
 * Check for app updates, install it in background and notify user that new version was installed.
 * @see https://www.electron.build/auto-update.html#quick-setup-guide
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() => import("electron-updater"))
    .then((module) => {
      const autoUpdater =
        module.autoUpdater ||
        // // @ts-expect-error Hotfix for https://github.com/electron-userland/electron-builder/issues/7338
        (module.default.autoUpdater as (typeof module)["autoUpdater"]);
      return autoUpdater.checkForUpdatesAndNotify();
    })
    .catch((e) => console.error("Failed check and install updates:", e));
}

async function handleCollectionOpen(event: IpcMainInvokeEvent) {
  return collectionOpen(event.sender);
}

async function handleDownloadLostTracksPlaylist(event: IpcMainInvokeEvent) {
  return downloadLostTracksPlaylist(event.sender);
}

async function handleDownloadDuplicateTracksPlaylist(event: IpcMainInvokeEvent) {
  return downloadDuplicateTracksPlaylist(event.sender);
}

async function handleDownloadPlaylist(event: IpcMainInvokeEvent, playlistName: string) {
  return downloadPlaylist(event.sender, playlistName);
}

async function handleFindDeletedTrackFiles(event: IpcMainInvokeEvent) {
  return findDeletedTrackFiles(event.sender);
}

async function handleKeepTrackFile(event: IpcMainInvokeEvent, path: string) {
  return keepTrackFile(path);
}

async function handleDeleteTrackFile(event: IpcMainInvokeEvent, path: string) {
  return deleteTrackFile(path);
}

function handleVersion(): string {
  return app.getVersion();
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:collectionOpen", handleCollectionOpen);
  ipcMain.handle("dialog:downloadLostTracksPlaylist", handleDownloadLostTracksPlaylist);
  ipcMain.handle("dialog:downloadDuplicateTracksPlaylist", handleDownloadDuplicateTracksPlaylist);
  ipcMain.handle("dialog:downloadPlaylist", handleDownloadPlaylist);
  ipcMain.handle("dialog:findDeletedTrackFiles", handleFindDeletedTrackFiles);
  ipcMain.handle("action:keepTrackFile", handleKeepTrackFile);
  ipcMain.handle("action:deleteTrackFile", handleDeleteTrackFile);
  ipcMain.handle("get:version", handleVersion);
});
