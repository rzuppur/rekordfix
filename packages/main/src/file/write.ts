import type { IpcMainInvokeEvent, SaveDialogOptions } from "electron";

import { BrowserWindow, dialog } from "electron";
import { promises } from "node:fs";

export type FileWriteResultCanceled = { canceled: true };
export type FileWriteResultError = { error: string };
export type FileWriteResultSuccess = { success: true; path: string };
export type FileWriteResult = FileWriteResultCanceled | FileWriteResultError | FileWriteResultSuccess;

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
  if (canceled) return { canceled: true };

  if (filePath) {
    await promises.writeFile(filePath, content, "utf-8");
    return { success: true, path: filePath };
  }

  return { error: "No filePath" };
}
