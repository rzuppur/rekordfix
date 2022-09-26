import type {IpcMainInvokeEvent} from 'electron';
import {app, ipcMain, dialog, BrowserWindow} from 'electron';
import {promises} from 'fs';
import {parseString} from 'xml2js';
import './security-restrictions';
import {restoreOrCreateWindow} from '/@/mainWindow';
import type {Collection} from '../../renderer/src/model';

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

/**
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', restoreOrCreateWindow);

/**
 * Create the application window when the background process is ready.
 */
app
  .whenReady()
  .then(restoreOrCreateWindow)
  .catch(e => console.error('Failed create window:', e));

/**
 * Check for new version of the application - production mode only.
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() => import('electron-updater'))
    .then(({autoUpdater}) => autoUpdater.checkForUpdatesAndNotify())
    .catch(e => console.error('Failed check updates:', e));
}

async function handleFileOpen(event: IpcMainInvokeEvent) {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) return;
  const {canceled, filePaths} = await dialog.showOpenDialog(browserWindow, {
    properties: ['openFile'],
    filters: [{name: 'XML Files', extensions: ['xml']}],
  });
  if (canceled) {
    return;
  } else {
    const path = filePaths[0];
    const fileContents = await promises.readFile(path, 'utf-8');
    if (fileContents) {
      const xml = await new Promise((resolve, reject) => {
        parseString(fileContents, (err: Error | null, result?: Collection) => {
          if (!err && result) {
            resolve(result);
          } else {
            reject(err);
          }
        });
      });

      return {
        xml,
        path,
      };
    }
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
    title: 'Save playlist',
    defaultPath: filename,
    buttonLabel: 'Save',
    filters: [{name: 'm3u8', extensions: ['m3u8']}],
  });
  if (filePath) {
    await promises.writeFile(filePath, content, 'utf-8');
    return filePath;
  }
}

app.whenReady().then(() => {
  ipcMain.handle('dialog:openFile', handleFileOpen);
  ipcMain.handle('downloadPlaylist', handlePlaylistSave);
});
