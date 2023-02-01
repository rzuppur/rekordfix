import type { IpcMainInvokeEvent } from "electron";
import type { CollectionParseResult } from "/@/rekordbox/collection";
import type { FileWriteResult } from "/@/file/write";

import { app, ipcMain } from "electron";
import "./security-restrictions";
import { restoreOrCreateWindow } from "/@/mainWindow";
import { readFileAsUtf8FromDialog } from "/@/file/read";
import { parseCollectionXML } from "/@/rekordbox/collection";
import { version } from "../../../package.json" assert { type: "json" };
import { writeFile } from "/@/file/write";

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
  const result = await readFileAsUtf8FromDialog(event.sender, "xml");
  if ("contents" in result) {
    return parseCollectionXML(result.contents, result.path);
  } else {
    if ("error" in result) return { error: result.error };
    return { error: "Canceled" };
  }
}

async function handlePlaylistSave(event: IpcMainInvokeEvent, content: string, filename: string): Promise<FileWriteResult> {
  return writeFile(event.sender, content, filename, "m3u8");
}

function handleVersion(): string {
  let packageVersion = version ?? "unknown";
  const appVersion = app.getVersion();
  if (appVersion != packageVersion) packageVersion += `, build ${appVersion}`;

  return packageVersion;
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:collectionOpen", handleCollectionOpen);
  ipcMain.handle("downloadPlaylist", handlePlaylistSave);
  ipcMain.handle("get:version", handleVersion);
});
