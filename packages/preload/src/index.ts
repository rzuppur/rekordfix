/**
 * @module preload
 */
import type { CollectionParseResult, DownloadPlaylistResult, FindDeletedTrackFilesResponse } from "../../main/src/rekordbox/collection";
import type { GenericResult } from "../../main/src/model";

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

export function downloadPlaylist(playlistName: string): Promise<DownloadPlaylistResult> {
  return ipcRenderer.invoke("dialog:downloadPlaylist", playlistName);
}

export function findDeletedTrackFiles(): Promise<FindDeletedTrackFilesResponse> {
  return ipcRenderer.invoke("dialog:findDeletedTrackFiles");
}

export function keepTrackFile(path: string): Promise<GenericResult> {
  return ipcRenderer.invoke("action:keepTrackFile", path);
}

export function deleteTrackFile(path: string): Promise<GenericResult> {
  return ipcRenderer.invoke("action:deleteTrackFile", path);
}

export function getVersion(): Promise<string> {
  return ipcRenderer.invoke("get:version");
}
