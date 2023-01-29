/**
 * @module preload
 */
import type {CollectionParseResult} from "../../main/src/rekordbox/collection";
import type {FileWriteResult} from "../../main/src/file/write";

export {versions} from "./versions";
const {ipcRenderer} = require("electron");

export function collectionOpen(): Promise<CollectionParseResult> {
  return ipcRenderer.invoke("dialog:collectionOpen");
}

export function downloadPlaylist(content: string, filename: string): Promise<FileWriteResult> {
  return ipcRenderer.invoke("downloadPlaylist", content, filename);
}

export function getVersion(): Promise<string> {
  return ipcRenderer.invoke("get:version");
}
