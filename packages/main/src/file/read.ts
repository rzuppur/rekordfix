import type { IpcMainInvokeEvent, OpenDialogOptions } from "electron";
import type { GenericResultError } from "../model";

import { BrowserWindow, dialog } from "electron";
import { promises } from "node:fs";
import { basename, join, extname } from "node:path";

export type FileReadResultSuccess = { contents: string; path: string };
export type FileReadResult = GenericResultError | FileReadResultSuccess;

export async function readFileAsUtf8FromDialog(eventSender: IpcMainInvokeEvent["sender"], extensionFilter?: string): Promise<FileReadResult> {
  const browserWindow = BrowserWindow.fromWebContents(eventSender);
  if (!browserWindow) return { error: "No browser window" };

  const dialogOptions: OpenDialogOptions = { properties: ["openFile"] };
  if (extensionFilter) {
    dialogOptions.filters = [{ name: `${extensionFilter} files`, extensions: [extensionFilter] }];
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(browserWindow, dialogOptions);
  if (canceled) return { error: "Dialogue canceled" };

  const path = filePaths[0];
  const contents = await promises.readFile(path, "utf-8");
  if (contents) return { contents, path };

  return { error: "No content" };
}

export type DirectoryTreeFile = { type: "FILE"; path: string; name: string; extension: string };
export type DirectoryTreeFolder = { type: "FOLDER"; path: string; name: string; children: (DirectoryTreeFile | DirectoryTreeFolder)[] };
export type DirectoryTree = DirectoryTreeFolder;
export type DirectoryReadResultSuccess = { tree: DirectoryTree };
export type DirectoryReadResult = GenericResultError | DirectoryReadResultSuccess;

export async function readDirectoryTree(eventSender: IpcMainInvokeEvent["sender"]): Promise<DirectoryReadResult> {
  const browserWindow = BrowserWindow.fromWebContents(eventSender);
  if (!browserWindow) return { error: "No browser window" };

  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (canceled) return { error: "Dialogue canceled" };

  const filePath = filePaths[0];
  const contents = await promises.readdir(filePath, {
    encoding: "utf-8",
    withFileTypes: true,
  });
  if (contents) {
    const tree: DirectoryTree = {
      type: "FOLDER",
      path: filePath,
      name: basename(filePath),
      children: [], // todo: multiple directory levels
    };

    for (const dirent of contents) {
      if (dirent.isDirectory()) {
        tree.children.push({ type: "FOLDER", path: join(filePath, dirent.name), name: dirent.name, children: [] });
      } else if (dirent.isFile()) {
        tree.children.push({
          type: "FILE",
          path: join(filePath, dirent.name),
          name: dirent.name,
          extension: extname(dirent.name).replace(".", "").toLowerCase(),
        });
      }
    }

    return { tree };
  }

  return { error: "No content" };
}

export async function getFileSize(filePath: string): Promise<number> {
  return (await promises.stat(filePath)).size;
}
