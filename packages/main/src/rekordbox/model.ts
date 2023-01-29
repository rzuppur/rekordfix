export interface TrackData {
  Album: string;
  Artist: string;
  AverageBpm: string;
  BitRate: string;
  Comments: string;
  Composer: string;
  DateAdded: string;
  DiscNumber: string;
  Genre: string;
  Grouping: string;
  Kind: string;
  Label: string;
  Location: string;
  Mix: string;
  Name: string;
  PlayCount: string;
  Rating: string;
  Remixer: string;
  SampleRate: string;
  Size: string;
  Tonality: string;
  TotalTime: string;
  TrackID: string;
  TrackNumber: string;
  Year: string;
}

export interface Track {
  $: TrackData;
}

export interface PlaylistData {
  Entries: string;
  KeyType: string;
  Name: string;
  Type: "1";
}

export interface PlaylistTrackData {
  Key: string;
}

export interface PlaylistTrack {
  $: PlaylistTrackData;
}

export interface Playlist {
  $: PlaylistData;
  TRACK: PlaylistTrack[];
}

export interface FolderData {
  Count: string;
  Name: string;
  Type: "0";
}

export interface Folder {
  $: FolderData;
  NODE: (Playlist | Folder)[];
}

export interface Collection {
  DJ_PLAYLISTS: {
    $: {
      Version: string;
    };
    COLLECTION: [
      {
        $: {
          Entries: string;
        };
        TRACK: Track[];
      },
    ];
    PLAYLISTS: [
      {
        NODE: [
          {
            $: {
              Type: "0";
              Name: "ROOT";
              Count: "string";
            };
            NODE: (Playlist | Folder)[];
          },
        ];
      },
    ];
    PRODUCT: [
      {
        $: {
          Name: string;
          Version: string;
          Company: string;
        };
      },
    ];
  };
}

export interface ParsedCollectionData {
  version: string;
  tracks: TrackData[];
  playlists: Playlist[];
  tracksInPlaylistsKeys: Set<string>;
  tracksNotInPlaylists: TrackData[];
  tracksProbableDuplicates: TrackData[][];
  playlistDuplicates: Map<string, string[]>;
  path: string;
}
