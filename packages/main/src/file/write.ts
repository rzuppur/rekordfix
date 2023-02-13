import type { IpcMainInvokeEvent, SaveDialogOptions } from "electron";
import type { GenericResult, GenericResultError } from "../model";

import { BrowserWindow, dialog } from "electron";
import { promises } from "node:fs";

export type FileWriteResultSuccess = { path: string };
export type FileWriteResult = GenericResultError | FileWriteResultSuccess;

export async function writeFile(eventSender: IpcMainInvokeEvent["sender"], content: string, filename: string, extension: string): Promise<FileWriteResult> {
  const browserWindow = BrowserWindow.fromWebContents(eventSender);
  if (!browserWindow) return { error: "No browser window" };

  const dialogOptions: SaveDialogOptions = {
    title: "Save file",
    defaultPath: filename,
    buttonLabel: "Save",
    filters: [{ name: extension, extensions: [extension] }],
  };

  const { filePath, canceled } = await dialog.showSaveDialog(browserWindow, dialogOptions);
  if (canceled) return { error: "Dialogue canceled" };

  if (filePath) {
    await promises.writeFile(filePath, content, "utf-8");
    return { path: filePath };
  }

  return { error: "No filePath" };
}

export async function ensureDirectory(path: string): Promise<GenericResult> {
  try {
    const stats = await promises.stat(path);
    if (stats.isDirectory()) return { success: true };
    return { error: `${path} is not a directory` };
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "ENOENT") {
      try {
        await promises.mkdir(path);
        return { success: true };
      } catch (e) {
        return { error: `${e}` };
      }
    }
    return { error: `${e}` };
  }
}

export async function moveFile(fromPath: string, toPath: string): Promise<GenericResult> {
  try {
    await promises.rename(fromPath, toPath);
    return { success: true };
  } catch (e) {
    return { error: `${e}` };
  }
}
