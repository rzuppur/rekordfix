import type {Collection, Folder, Playlist, TrackData, ParsedCollectionData} from "./model";

import {parseXML} from "../file/xml";

export type CollectionParseResultError = {error: string};
export type CollectionParseResult = CollectionParseResultError | ParsedCollectionData;

const parsedCollection: ParsedCollectionData | null = null;

function getPlaylists(list: (Playlist | Folder)[], folderPrefix?: string): Playlist[] {
  const result: Playlist[] = [];
  list.forEach(item => {
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
  list.forEach(item => {
    if (item.$.Type === "1") {
      const playlist = item as Playlist;
      if (playlist.TRACK) {
        result.push(...playlist.TRACK.map(t => t.$.Key));
      }
    } else if (item.$.Type === "0") {
      const list = (item as Folder).NODE;
      if (list) result.push(...getTracks(list));
    }
  });

  return result;
}

export async function parseCollectionXML(
  contents: string,
  path: string,
): Promise<CollectionParseResult> {
  try {
    const collection = await parseXML<Collection>(contents);
    if (!collection) return {error: "Could not parse XML"};

    const tracks = collection.DJ_PLAYLISTS.COLLECTION[0].TRACK.map(t => t.$);
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
      for (const [trackPosition, trackKey] of playlist.TRACK.map(t => t.$.Key).entries()) {
        if (trackKeys.has(trackKey)) {
          const track = tracks.find(track => track.TrackID === trackKey);
          duplicates.push(
            track ? `${trackPosition + 1}. ${track.Artist} - ${track.Name}` : trackKey,
          );
        } else {
          trackKeys.add(trackKey);
        }
      }
      if (duplicates.length) {
        playlistDuplicates.set(playlist.$.Name, duplicates);
      }
    }

    return {
      version: collection.DJ_PLAYLISTS.PRODUCT[0].$.Version,
      tracks,
      playlists,
      tracksInPlaylistsKeys,
      tracksNotInPlaylists: tracks.filter(track => !tracksInPlaylistsKeys.has(track.TrackID)),
      tracksProbableDuplicates,
      playlistDuplicates,
      path,
    };
  } catch (e: unknown) {
    console.error(e);
    return {error: `${e}`};
  }
}
