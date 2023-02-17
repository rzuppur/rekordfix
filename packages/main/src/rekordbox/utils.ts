import type { TrackData } from "./model";

import { URL } from "node:url";
import { sep } from "node:path";

export function cleanLocationString(location: string): string {
  return decodeURI(location).replaceAll("%26", "&");
}

export function createM3u8Playlist(tracks: TrackData[]): string {
  let m3u8 = "#EXTM3U\n";
  for (const track of tracks) {
    m3u8 += `#EXTINF:${track.TotalTime},${track.Artist} - ${track.Name}\n`;
    m3u8 += `${cleanLocationString(track.Location)}\n`;
  }
  return m3u8;
}

export function collectionTrackLocationToPath(location: string): string {
  const urlPathname: string = new URL(location.replaceAll("#", "%23")).pathname;
  return decodeURIComponent(urlPathname.replaceAll("/", sep).replace(/^\\(?=[A-Z]:\\)/, ""));
}
