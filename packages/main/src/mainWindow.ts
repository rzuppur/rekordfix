import { app, BrowserWindow, protocol } from "electron";
import { join } from "node:path";
import { URL } from "node:url";
import fs from "node:fs";
import { stat } from "node:fs/promises";
import mime from "mime-types";
import { Readable } from "node:stream";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      stream: true,
    },
  },
]);

async function createWindow() {
  protocol.handle("media", async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(process.platform === "win32" ? `${url.hostname}:${url.pathname}` : url.pathname);
    try {
      const fileStat = await stat(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";
      const range = request.headers.get("range");
      if (!range) throw {};
      const [, startStr, endStr] = /^bytes=(\d*)-(\d*)$/.exec(range) || [];
      const start = parseInt(startStr || "0", 10);
      const end = endStr ? parseInt(endStr, 10) : fileStat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
          "Accept-Ranges": "bytes",
        },
      });
    } catch (error) {
      console.error(error);
      return new Response(null, { status: 500 });
    }
  });

  const browserWindow = new BrowserWindow({
    show: false,
    width: import.meta.env.DEV ? 1100 : 600,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: join(app.getAppPath(), "packages/preload/dist/index.cjs"),
    },
  });

  browserWindow.setMenuBarVisibility(false);

  browserWindow.on("ready-to-show", () => {
    browserWindow?.show();

    if (import.meta.env.DEV) {
      browserWindow?.webContents.openDevTools();
    }
  });

  /**
   * URL for main window.
   * Vite dev server for development.
   * `file://../renderer/index.html` for production and test.
   */
  const pageUrl = import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined ? import.meta.env.VITE_DEV_SERVER_URL : new URL("../renderer/dist/index.html", "file://" + __dirname).toString();

  await browserWindow.loadURL(pageUrl);

  return browserWindow;
}

/**
 * Restore an existing BrowserWindow or Create a new BrowserWindow.
 */
export async function restoreOrCreateWindow() {
  let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

  if (window === undefined) {
    window = await createWindow();
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
}
