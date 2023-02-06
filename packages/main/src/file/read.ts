import type { IpcMainInvokeEvent, OpenDialogOptions } from "electron";

import { BrowserWindow, dialog } from "electron";
import { promises } from "node:fs";

export type FileReadResultCanceled = { canceled: true };
export type FileReadResultError = { error: string };
export type FileReadResultSuccess = { contents: string; path: string };
export type FileReadResult = FileReadResultCanceled | FileReadResultError | FileReadResultSuccess;

export async function readFileAsUtf8FromDialog(eventSender: IpcMainInvokeEvent["sender"], extensionFilter?: string): Promise<FileReadResult> {
  const browserWindow = BrowserWindow.fromWebContents(eventSender);
  if (!browserWindow) return { error: "No browser window" };

  const dialogOptions: OpenDialogOptions = { properties: ["openFile"] };
  if (extensionFilter) {
    dialogOptions.filters = [{ name: `${extensionFilter} files`, extensions: [extensionFilter] }];
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(browserWindow, dialogOptions);
  if (canceled) return { canceled: true };

  const path = filePaths[0];
  const contents = await promises.readFile(path, "utf-8");
  if (contents) return { contents, path };

  return { error: "No content" };
}
