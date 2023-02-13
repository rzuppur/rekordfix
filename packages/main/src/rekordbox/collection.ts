import type { Collection, Folder, Playlist, TrackData, ParsedCollectionData, FilePathWithSize } from "./model";
import type { IpcMainInvokeEvent } from "electron";
import type { GenericResult, GenericResultError } from "../model";

import { dirname, join, basename } from "node:path";
import { getFileSize, readDirectoryTree, readFileAsUtf8FromDialog } from "../file/read";
import { ensureDirectory, moveFile, writeFile } from "../file/write";
import { parseXML } from "../file/xml";
import { collectionTrackLocationToPath, createM3u8Playlist } from "./utils";
import sanitize from "sanitize-filename";

export type CollectionParseResult = GenericResultError | ParsedCollectionData;

let parsedCollection: ParsedCollectionData | null = null;

function getPlaylists(list: (Playlist | Folder)[], folderPrefix?: string): Playlist[] {
  const result: Playlist[] = [];
  list.forEach((item) => {
    if (item.$.Type === "1") {
      const playlist = item as Playlist;
      if (folderPrefix) playlist.$.Name = `${folderPrefix} > ${playlist.$.Name}`;
      result.push(playlist);
    } else if (item.$.Type === "0") {
      const list = (item as Folder).NODE;
      let folderPath = item.$.Name;
      if (folderPrefix) folderPath = `${folderPrefix} > ${folderPath}`;
      if (list) result.push(...getPlaylists(list, folderPath));
    }
  });

  return result;
}

function getTracks(list: (Playlist | Folder)[]): string[] {
  const result: string[] = [];
  list.forEach((item) => {
    if (item.$.Type === "1") {
      const playlist = item as Playlist;
      if (playlist.TRACK) {
        result.push(...playlist.TRACK.map((t) => t.$.Key));
      }
    } else if (item.$.Type === "0") {
      const list = (item as Folder).NODE;
      if (list) result.push(...getTracks(list));
    }
  });

  return result;
}

export async function parseCollectionXML(contents: string, path: string): Promise<CollectionParseResult> {
  try {
    const collection = await parseXML<Collection>(contents);
    if (!collection) return { error: "Could not parse XML" };

    const tracks = collection.DJ_PLAYLISTS.COLLECTION[0].TRACK.map((t) => t.$);
    const playlistTree = collection.DJ_PLAYLISTS.PLAYLISTS[0].NODE[0].NODE;
    const playlists = getPlaylists(playlistTree);
    const tracksInPlaylistsKeys = new Set(getTracks(playlistTree));
    const trackNames: Map<string, TrackData> = new Map();
    const tracksProbableDuplicates: TrackData[][] = [];
    for (const track of tracks) {
      const name = `${track.Artist} - ${track.Name}`;
      if (trackNames.has(name)) {
        tracksProbableDuplicates.push([track, trackNames.get(name) as TrackData]);
      } else {
        trackNames.set(name, track);
      }
    }
    const playlistDuplicates: Map<string, string[]> = new Map();
    for (const playlist of playlists) {
      if (!playlist.TRACK || !playlist.TRACK.length) continue;
      const duplicates = [];
      const trackKeys = new Set();
      for (const [trackPosition, trackKey] of playlist.TRACK.map((t) => t.$.Key).entries()) {
        if (trackKeys.has(trackKey)) {
          const track = tracks.find((track) => track.TrackID === trackKey);
          duplicates.push(track ? `${trackPosition + 1}. ${track.Artist} - ${track.Name}` : trackKey);
        } else {
          trackKeys.add(trackKey);
        }
      }
      if (duplicates.length) {
        playlistDuplicates.set(playlist.$.Name, duplicates);
      }
    }

    parsedCollection = {
      version: collection.DJ_PLAYLISTS.PRODUCT[0].$.Version,
      tracks,
      playlists,
      tracksInPlaylistsKeys,
      tracksNotInPlaylists: tracks.filter((track) => !tracksInPlaylistsKeys.has(track.TrackID)),
      tracksProbableDuplicates,
      playlistDuplicates,
      path,
    };

    return parsedCollection;
  } catch (e: unknown) {
    console.error(e);
    return { error: `${e}` };
  }
}

export async function collectionOpen(eventSender: IpcMainInvokeEvent["sender"]): Promise<CollectionParseResult> {
  const result = await readFileAsUtf8FromDialog(eventSender, "xml");
  if ("contents" in result) {
    return parseCollectionXML(result.contents, result.path);
  } else {
    return { error: result.error };
  }
}

export type DownloadPlaylistResultSuccess = { path: string };
export type DownloadPlaylistResult = GenericResultError | DownloadPlaylistResultSuccess;

export async function downloadLostTracksPlaylist(eventSender: IpcMainInvokeEvent["sender"]): Promise<DownloadPlaylistResult> {
  if (!parsedCollection) return { error: "No collection loaded" };

  const playlistFileContents = createM3u8Playlist(parsedCollection.tracksNotInPlaylists);
  return writeFile(eventSender, playlistFileContents, "lost_tracks", "m3u8");
}

export async function downloadDuplicateTracksPlaylist(eventSender: IpcMainInvokeEvent["sender"]): Promise<DownloadPlaylistResult> {
  if (!parsedCollection) return { error: "No collection loaded" };

  const playlistFileContents = createM3u8Playlist(parsedCollection.tracksProbableDuplicates.reduce((prev, current) => prev.concat(current), []));
  return writeFile(eventSender, playlistFileContents, "duplicate_tracks", "m3u8");
}

export async function downloadPlaylist(eventSender: IpcMainInvokeEvent["sender"], playlistName: string): Promise<DownloadPlaylistResult> {
  if (!parsedCollection) return { error: "No collection loaded" };

  const playlist = parsedCollection.playlists.find((playlist) => playlist.$.Name === playlistName);
  if (!playlist) return { error: `Invalid playlist name: ${playlistName}` };

  const playlistTracks: TrackData[] = playlist.TRACK.map((playlistTrack) => parsedCollection?.tracks.find((track) => track.TrackID === playlistTrack.$.Key)).filter((track) => !!track) as TrackData[];
  const playlistFileContents = createM3u8Playlist(playlistTracks);
  return writeFile(eventSender, playlistFileContents, sanitize(playlistName, { replacement: "_" }), "m3u8");
}

export type FindDeletedTrackFilesResponse = GenericResultError | { paths: FilePathWithSize[] };

export async function findDeletedTrackFiles(eventSender: IpcMainInvokeEvent["sender"]): Promise<FindDeletedTrackFilesResponse> {
  if (!parsedCollection) return { error: "No collection loaded" };

  const result = await readDirectoryTree(eventSender);
  if ("error" in result) return { error: result.error };

  const collectionTrackPaths: string[] = parsedCollection.tracks.map((track) => collectionTrackLocationToPath(track.Location));
  const notInCollectionFiles: FilePathWithSize[] = [];
  for (const item of result.tree.children) {
    if (item.type === "FOLDER" || !["mp3", "wav", "aac", "flac", "alac", "aiff"].includes(item.extension)) continue;
    if (!collectionTrackPaths.includes(item.path)) {
      notInCollectionFiles.push({ path: item.path, size: await getFileSize(item.path) });
    }
  }

  return { paths: notInCollectionFiles };
}

export async function keepTrackFile(path: string): Promise<GenericResult> {
  const folderPath = join(dirname(path), "KEEP");
  const directoryResult = await ensureDirectory(folderPath);
  if ("error" in directoryResult) return directoryResult;

  const newPath = join(folderPath, basename(path));
  return await moveFile(path, newPath);
}

export async function deleteTrackFile(path: string): Promise<GenericResult> {
  const folderPath = join(dirname(path), "DELETE");
  const directoryResult = await ensureDirectory(folderPath);
  if ("error" in directoryResult) return directoryResult;

  const newPath = join(folderPath, basename(path));
  return await moveFile(path, newPath);
}
