import type {IpcMainInvokeEvent} from "electron";
import type {CollectionParseResult} from "/@/rekordbox/collection";

import {app, ipcMain, dialog, BrowserWindow} from "electron";
import {promises} from "fs";
import "./security-restrictions";
import {restoreOrCreateWindow} from "/@/mainWindow";
import {readFileAsUtf8FromDialog} from "/@/file/read";
import {parseCollectionXML} from "/@/rekordbox/collection";
import {version} from "../../../package.json" assert {type: "json"};

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
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

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
  .catch(e => console.error("Failed create window:", e));

/**
 * Check for new version of the application - production mode only.
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() => import("electron-updater"))
    .then(({autoUpdater}) => autoUpdater.checkForUpdatesAndNotify())
    .catch(e => console.error("Failed check updates:", e));
}

async function handleCollectionOpen(event: IpcMainInvokeEvent): Promise<CollectionParseResult> {
  const result = await readFileAsUtf8FromDialog(event.sender, "xml");
  if ("contents" in result) {
    return parseCollectionXML(result.contents, result.path);
  } else {
    if ("error" in result) return {error: result.error};
    return {error: "cancelled"};
  }
}

async function handlePlaylistSave(
  event: IpcMainInvokeEvent,
  content: string,
  filename: string,
): Promise<string | undefined> {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) return;
  const {filePath} = await dialog.showSaveDialog(browserWindow, {
    title: "Save playlist",
    defaultPath: filename,
    buttonLabel: "Save",
    filters: [{name: "m3u8", extensions: ["m3u8"]}],
  });
  if (filePath) {
    await promises.writeFile(filePath, content, "utf-8");
    return filePath;
  }
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
