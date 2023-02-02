/**
 * @module preload
 */
import type { CollectionParseResult, DownloadPlaylistResult } from "../../main/src/rekordbox/collection";

export { versions } from "./versions";
const { ipcRenderer } = require("electron");

export function collectionOpen(): Promise<CollectionParseResult> {
  return ipcRenderer.invoke("dialog:collectionOpen");
}

export function downloadLostTracksPlaylist(): Promise<DownloadPlaylistResult> {
  return ipcRenderer.invoke("dialog:downloadLostTracksPlaylist");
}

export function downloadDuplicateTracksPlaylist(): Promise<DownloadPlaylistResult> {
  return ipcRenderer.invoke("dialog:downloadDuplicateTracksPlaylist");
}

export function getVersion(): Promise<string> {
  return ipcRenderer.invoke("get:version");
}
