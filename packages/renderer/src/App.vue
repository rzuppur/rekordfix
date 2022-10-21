<script lang="ts" setup>
import {openXML, downloadPlaylist} from '#preload';
import type {Ref} from 'vue';
import {ref} from 'vue';
import type {Folder, Playlist, TrackData} from '/@/model';
import {useToast} from '@rzuppur/rvc';
import {cleanLocationString, formatSeconds} from '/@/utils';
import PlaylistsView from '/@/components/PlaylistsView.vue';

const toast = useToast();

// STATE
const collectionLoaded = ref(false);
const collectionLoading = ref(false);
const errorText = ref('');
const playlistSaving = ref(false);

// DATA
const collectionTracks: Ref<TrackData[]> = ref([]);
const collectionPlaylists: Ref<Playlist[]> = ref([]);
const collectionTracksNotInPlaylists: Ref<TrackData[]> = ref([]);
const collectionTracksProbableDuplicates: Ref<TrackData[][]> = ref([]);
const collectionTracksInPlaylistsKeys: Ref<Set<string>> = ref(new Set());
const collectionPlaylistDuplicates: Ref<Map<string, string[]>> = ref(new Map());
const collectionFilePath: Ref<string> = ref('');
const collectionVersion: Ref<string> = ref('');

const resetCollection = () => {
  collectionLoading.value = false;
  collectionLoaded.value = false;
  collectionTracks.value = [];
  collectionPlaylists.value = [];
  collectionTracksNotInPlaylists.value = [];
  collectionTracksProbableDuplicates.value = [];
  collectionTracksInPlaylistsKeys.value = new Set();
  collectionPlaylistDuplicates.value = new Map();
  collectionFilePath.value = '';
  collectionVersion.value = '';
};

const getTracks = (list: (Playlist | Folder)[]): string[] => {
  const result: string[] = [];
  list.forEach(item => {
    if (item.$.Type === '1') {
      const playlist = item as Playlist;
      collectionPlaylists.value.push(playlist);
      if (playlist.TRACK) {
        result.push(...playlist.TRACK.map(t => t.$.Key));
      }
    } else if (item.$.Type === '0') {
      result.push(...getTracks((item as Folder).NODE));
    }
  });
  return result;
};

const actionOpenXML = async () => {
  collectionLoading.value = true;
  try {
    const {xml: collection, path, cancelled} = await openXML();
    if (cancelled) {
      resetCollection();
      return;
    }
    if (collection) {
      collectionVersion.value = collection.DJ_PLAYLISTS.PRODUCT[0].$.Version;
      collectionTracks.value = collection.DJ_PLAYLISTS.COLLECTION[0].TRACK.map(t => t.$);

      const playlistTree = collection.DJ_PLAYLISTS.PLAYLISTS[0].NODE[0].NODE;
      collectionTracksInPlaylistsKeys.value = new Set(getTracks(playlistTree));
      collectionTracksNotInPlaylists.value = collectionTracks.value.filter(track => {
        return !collectionTracksInPlaylistsKeys.value.has(track.TrackID);
      });

      const trackNames: Map<string, TrackData> = new Map();
      for (const track of collectionTracks.value) {
        const name = `${track.Artist} - ${track.Name}`;
        if (trackNames.has(name)) {
          collectionTracksProbableDuplicates.value.push([track, trackNames.get(name) as TrackData]);
        } else {
          trackNames.set(name, track);
        }
      }

      for (const playlist of collectionPlaylists.value) {
        if (!playlist.TRACK || !playlist.TRACK.length) continue;
        const duplicates = [];
        const trackKeys = new Set();
        for (const [trackPosition, trackKey] of playlist.TRACK.map(t => t.$.Key).entries()) {
          if (trackKeys.has(trackKey)) {
            const track = collectionTracks.value.find(t => t.TrackID === trackKey);
            duplicates.push(
              track ? `${trackPosition + 1}. ${track.Artist} - ${track.Name}` : trackKey,
            );
          } else {
            trackKeys.add(trackKey);
          }
        }
        if (duplicates.length) {
          collectionPlaylistDuplicates.value.set(playlist.$.Name, duplicates);
        }
      }

      collectionLoading.value = false;
      collectionLoaded.value = true;
      errorText.value = '';
      collectionFilePath.value = path;
    } else {
      errorText.value = 'Something went wrong';
      resetCollection();
    }
  } catch (e) {
    console.error(e);
    toast('❌ ' + e);
    errorText.value = 'Error reading the file, make sure you followed the instructions above.';
    resetCollection();
  }
};

const actionSaveLostPlaylist = async () => {
  playlistSaving.value = true;
  let m3u8 = '#EXTM3U\n';
  collectionTracksNotInPlaylists.value.forEach(track => {
    m3u8 += `#EXTINF:${track.TotalTime},${track.Artist} - ${track.Name}\n`;
    m3u8 += `${cleanLocationString(track.Location)}\n`;
  });
  const path = await downloadPlaylist(m3u8, 'lost_tracks');
  if (path) toast(`✔ Playlist saved to ${path}`);
  playlistSaving.value = false;
};

const actionSaveDuplicatePlaylist = async () => {
  playlistSaving.value = true;
  let m3u8 = '#EXTM3U\n';
  for (const duplicateTracks of collectionTracksProbableDuplicates.value) {
    for (const track of duplicateTracks) {
      m3u8 += `#EXTINF:${track.TotalTime},${track.Artist} - ${track.Name}\n`;
      m3u8 += `${cleanLocationString(track.Location)}\n`;
    }
  }

  const path = await downloadPlaylist(m3u8, 'duplicate_tracks');
  if (path) toast(`✔ Playlist saved to ${path}`);
  playlistSaving.value = false;
};
</script>
<template lang="pug">

.r-text-xs.r-p-b-lg.r-background-raised
  .r-p-lg(v-if="!collectionLoaded")
    p Go to Rekordbox and select #{""}
      b File > Export Collection in xml format
      | . Then find the file you just exported and open it here.
    r-button.r-space(primary :loading="collectionLoading" icon="search file" :action="actionOpenXML") Open XML Collection File
    .background-error.r-p-md.r-border-radius-md.r-text-color-red.r-text-medium.r-space(v-if="errorText") {{ errorText }}

  .r-p-lg(v-else)
    r-button.r-m-b-md(borderless small :action="resetCollection" icon="arrow left" icon-color="blue") Back
    .r-text-sm.r-text-medium {{ collectionFilePath }}
    .r-text-xxs.r-text-color-muted Rekordbox version {{ collectionVersion }} &middot; {{ collectionTracks.length }} tracks &middot;&nbsp;
      a(@click="() => { $refs.playlists.open(); }") {{ collectionPlaylists.length }} playlists
    .r-text-xxs.r-text-color-muted Last track added: "{{ collectionTracks.slice(-1)[0].Name }}" on {{ collectionTracks.slice(-1)[0].DateAdded }}

    PlaylistsView(ref="playlists" :collectionPlaylists="collectionPlaylists" :collectionTracks="collectionTracks")

    .r-m-t-lg(v-if="collectionTracksNotInPlaylists.length")
      h2.r-text-md.r-text-medium
        r-icon.red.r-m-r-sm(icon="attention")
        | {{ collectionTracksNotInPlaylists.length }} lost track{{ collectionTracksNotInPlaylists.length === 1 ? "" : "s" }}
      .r-text-color-muted.r-m-t-xs These tracks are in collection but weren't found in any playlist. You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can either add them to a playlist or delete from collection.
      r-button.r-m-t-md(primary :action="actionSaveLostPlaylist" :loading="playlistSaving" icon="download") Export tracks
    h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
      r-icon.green.r-m-r-sm(icon="check")
      | All collection tracks are in playlists

    .r-m-t-lg(v-if="collectionPlaylistDuplicates.size")
      h2.r-text-md.r-text-medium
        r-icon.red.r-m-r-sm(icon="attention")
        | {{ collectionPlaylistDuplicates.size }} playlist{{ collectionPlaylistDuplicates.size === 1 ? " has" : "s have" }} duplicate tracks
      .r-m-t-sm(v-for="playlist in collectionPlaylistDuplicates")
        .r-text-medium {{ playlist[0] }}
        .r-text-color-muted(v-for="track in playlist[1]") &bullet; {{ track }}
    h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
      r-icon.green.r-m-r-sm(icon="check")
      | No duplicates in playlists

    .r-m-t-lg(v-if="collectionTracksProbableDuplicates.length")
      h2.r-text-md.r-text-medium
        r-icon.red.r-m-r-sm(icon="attention")
        | {{ collectionTracksProbableDuplicates.length }} probable duplicate tracks
      .r-text-color-muted.r-m-t-xs You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can delete one of the files from collection.
      .r-buttons.r-m-t-md.r-m-b-md
        r-button(primary :action="actionSaveDuplicatePlaylist" :loading="playlistSaving" icon="download") Export tracks
        r-button(gray borderless :action="() => { $refs.duplicatesModal.open(); }") View list
        r-modal(ref="duplicatesModal" size="fill" title="Duplicate tracks" :buttons="false")
          .r-m-t-sm(v-for="tracks in collectionTracksProbableDuplicates")
            .r-text-bold {{ tracks[0].Artist }} - {{ tracks[0].Name }}
            .r-text-xxs.r-ellipsis(v-for="track in tracks")
              span.r-text-medium {{ formatSeconds(track.TotalTime) }}
              span.r-text-color-muted &nbsp;{{ cleanLocationString(track.Location).replace("file://localhost/", "") }}
    h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
      r-icon.green.r-m-r-sm(icon="check")
      | No duplicates in collection

</template>
<style lang="stylus">

code
  font-family ui-monospace, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono", "Droid Sans Mono", "Courier New", monospace
  font-size 0.9em
  letter-spacing -0.02em
  opacity 0.8

body
  --t-family "Inter", "Twemoji Mozilla", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", sans-serif

$font-range-cyrillic-ext = U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F
$font-range-cyrillic = U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116
$font-range-greek-ext = U+1F00-1FFF
$font-range-greek = U+0370-03FF
$font-range-vietnamese = U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9, U+20AB
$font-range-latin-ext = U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF
$font-range-latin = U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD

inter-variable()
  font-family "Inter"
  font-weight 100 900
  font-display swap
  font-style oblique 0deg 10deg
  font-feature-settings "ccmp", "locl", "mark", "kern", "pnum", "cpsp"

@font-face
  inter-variable()
  src url("assets/fonts/inter-var-cyrillic-ext.woff2") format("woff2-variations")
  unicode-range $font-range-cyrillic-ext

@font-face
  inter-variable()
  src url("assets/fonts/inter-var-cyrillic.woff2") format("woff2-variations")
  unicode-range: $font-range-cyrillic

@font-face
  inter-variable()
  src url("assets/fonts/inter-var-greek-ext.woff2") format("woff2-variations")
  unicode-range $font-range-greek-ext

@font-face
  inter-variable()
  src url("assets/fonts/inter-var-greek.woff2") format("woff2-variations")
  unicode-range $font-range-greek

@font-face
  inter-variable()
  src url("assets/fonts/inter-var-vietnamese.woff2") format("woff2-variations")
  unicode-range $font-range-vietnamese

@font-face
  inter-variable()
  src url("assets/fonts/inter-var-latin-ext.woff2") format("woff2-variations")
  unicode-range $font-range-latin-ext

@font-face
  inter-variable()
  src url("assets/fonts/inter-var-latin.woff2") format("woff2-variations")
  unicode-range $font-range-latin

i,
em,
dfn
  font-style normal
  font-variation-settings "slnt" -10
</style>
