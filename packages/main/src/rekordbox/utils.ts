import type { TrackData } from "/@/rekordbox/model";

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
