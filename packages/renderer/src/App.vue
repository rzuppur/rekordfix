<script lang="ts" setup>
import type { ParsedCollectionData, FilePathWithSize } from "../../main/src/rekordbox/model";
import type { ComputedRef, Ref } from "vue";
import type { HTMLAudioElement } from "happy-dom";

import { collectionOpen, downloadLostTracksPlaylist, downloadDuplicateTracksPlaylist, getVersion, downloadPlaylist, findDeletedTrackFiles, keepTrackFile, deleteTrackFile } from "#preload";
import { computed, reactive, ref } from "vue";
import { useToast } from "@rzuppur/rvc";
import { formatSeconds } from "./utils";
import PlaylistsView from "./components/PlaylistsView.vue";

// COMMUNICATION
const toast = useToast();
const onError = (error: unknown) => {
  console.error(error);
  toast(`❌ ${error}`);
};

// STATE & DATA
type ApplicationViewState = "UNLOADED" | "LOADING" | "LOADED" | "LOADED_MODAL_OPEN" | "PLAYLIST_DETAILS" | "PLAYLIST_DETAILS_MODAL_OPEN";
let collection: ParsedCollectionData | Record<string, never> = reactive({});
const state: Ref<ApplicationViewState> = ref("UNLOADED");

const resetCollection = () => {
  state.value = "UNLOADED";
  collection = reactive({});
  deletedTrackFiles.value = [];
};

const canSavePlaylist: ComputedRef<ApplicationViewState | false> = computed(() => {
  if (state.value === "LOADED" || state.value === "PLAYLIST_DETAILS") return state.value;
  return false;
});

// USER ACTIONS
const actionOpenCollection = async () => {
  state.value = "LOADING";

  try {
    const response = await collectionOpen();
    if ("error" in response) throw new Error(response.error);
    collection = reactive(response);
    state.value = "LOADED";
  } catch (e) {
    onError(e);
    resetCollection();
  }
};

const actionDownloadLostTracksPlaylist = async () => {
  const prevState = canSavePlaylist.value;
  if (!prevState) return;
  state.value = "LOADED_MODAL_OPEN";

  try {
    const response = await downloadLostTracksPlaylist();
    if ("error" in response) throw new Error(response.error);
    toast(`✔ Playlist saved to ${response.path}`);
  } catch (e) {
    onError(e);
  } finally {
    state.value = prevState;
  }
};

const actionDownloadDuplicateTracksPlaylist = async () => {
  const prevState = canSavePlaylist.value;
  if (!prevState) return;
  state.value = "LOADED_MODAL_OPEN";

  try {
    const response = await downloadDuplicateTracksPlaylist();
    if ("error" in response) throw new Error(response.error);
    toast(`✔ Playlist saved to ${response.path}`);
  } catch (e) {
    onError(e);
  } finally {
    state.value = prevState;
  }
};

const actionDownloadPlaylist = async (playlistName: string) => {
  const prevState = canSavePlaylist.value;
  if (!prevState) return;
  state.value = "PLAYLIST_DETAILS_MODAL_OPEN";

  try {
    const response = await downloadPlaylist(playlistName);
    if ("error" in response) throw new Error(response.error);
    toast(`✔ Playlist saved to ${response.path}`);
  } catch (e) {
    onError(e);
  } finally {
    state.value = prevState;
  }
};

// FIND DELETED TRACKS
const deletedTrackFiles: Ref<FilePathWithSize[]> = ref([]);
const deletedTrackFileSelectedIndex: Ref<number | null> = ref(null);
const audioPlayerRef: Ref<null | HTMLAudioElement[]> = ref(null);

const actionFindDeletedTrackFiles = async () => {
  const prevState = canSavePlaylist.value;
  if (!prevState) return;
  state.value = "LOADED_MODAL_OPEN";

  try {
    const response = await findDeletedTrackFiles();
    if ("error" in response) throw new Error(response.error);
    deletedTrackFiles.value = response.paths;
  } catch (e) {
    deletedTrackFiles.value = [];
    onError(e);
  } finally {
    state.value = prevState;
  }
};

const unloadAudio = async () => {
  const index = deletedTrackFileSelectedIndex.value;
  deletedTrackFileSelectedIndex.value = -1;
  const player = audioPlayerRef.value?.[0];
  if (!player) return;
  player.pause();
  player.src = "";
  player.load();
  player.parentNode.removeChild(player);
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  deletedTrackFileSelectedIndex.value = index;
};

const actionKeepTrackFile = async (path: string) => {
  await unloadAudio();
  const restoreCopy = [...deletedTrackFiles.value];
  deletedTrackFiles.value = deletedTrackFiles.value.filter((trackFile) => trackFile.path !== path);
  try {
    const response = await keepTrackFile(path);
    if ("error" in response) throw new Error(response.error);
    toast("Track moved to ./KEEP");
  } catch (e) {
    onError(e);
    deletedTrackFiles.value = restoreCopy;
  }
};

const actionDeleteTrackFile = async (path: string) => {
  await unloadAudio();
  const restoreCopy = [...deletedTrackFiles.value];
  deletedTrackFiles.value = deletedTrackFiles.value.filter((trackFile) => trackFile.path !== path);
  try {
    const response = await deleteTrackFile(path);
    if ("error" in response) throw new Error(response.error);
    toast("Track moved to ./DELETE");
  } catch (e) {
    onError(e);
    deletedTrackFiles.value = restoreCopy;
  }
};

// GET APP VERSION
const version = ref("");
(async () => {
  version.value = await getVersion();
})();

// UTILS
const formatSizeToMB = (size: number): string => {
  const MB = size / 1024 / 1024;
  if (MB >= 1000) return `${Math.round(MB / 100) / 10}GB`;
  return MB.toLocaleString("en", {
    notation: "compact",
    style: "unit",
    unit: "megabyte",
    unitDisplay: "narrow",
  });
};
</script>

<template lang="pug">

.r-text-xs.r-p-b-lg.r-background-raised

  .block-interface-cover(v-if="state === 'LOADING' || state === 'LOADED_MODAL_OPEN'")

  .r-p-lg(v-if="state === 'UNLOADED' || state === 'LOADING'")
    p Open your collection export to get started.
    ul.r-space
      li Go to Rekordbox
      li Select #{""}
        b File > Export Collection in xml format
      li Open the file you just exported
    r-button.r-m-t-lg(primary :loading="state === 'LOADING'" icon="file_open" :action="actionOpenCollection") Open XML Collection File

  .r-p-lg(v-else-if="state === 'PLAYLIST_DETAILS' || state === 'PLAYLIST_DETAILS_MODAL_OPEN'")
    PlaylistsView(
      :collectionPlaylists="collection.playlists"
      :collectionTracks="collection.tracks"
      @back="() => { state = 'LOADED'; }"
      @downloadPlaylist="actionDownloadPlaylist"
    )

  .r-p-lg(v-else)

    r-button.r-m-b-md(:action="resetCollection" icon="arrow_back") Back

    .r-p-sm.r-background.r-border-radius-sm
      .r-text-xxs.r-text-bold {{ collection.path }}
      .r-text-xxs.r-text-color-muted Rekordbox version {{ collection.version }} &middot; {{collection.tracks.length }} tracks &middot;&nbsp;
        a(@click="() => { state = 'PLAYLIST_DETAILS'; }") {{ collection.playlists.length }} playlists
      .r-text-xxs.r-text-color-muted Last track added: "{{ collection.tracks.slice(-1)[0].Name }}" on {{ collection.tracks.slice(-1)[0].DateAdded }}

    .r-m-t-lg(v-if="collection.tracksNotInPlaylists.length")
      h2.r-text-md.r-text-medium
        r-icon.yellow.r-m-r-sm(icon="error_circle_rounded" size="lg")
        | {{ collection.tracksNotInPlaylists.length }} lost track{{ collection.tracksNotInPlaylists.length === 1 ? "" : "s" }}
      .r-text-color-muted.r-m-t-sm These tracks are in collection but weren't found in any playlist. You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can either add them to a playlist or delete from collection.
      r-button.r-m-t-md(primary :action="actionDownloadLostTracksPlaylist" :loading="state === 'LOADED_MODAL_OPEN'" icon="download") Export tracks
    h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
      r-icon.green.r-m-r-sm(icon="check" size="lg")
      | All collection tracks are in playlists

    .r-m-t-lg(v-if="collection.playlistDuplicates.size")
      h2.r-text-md.r-text-medium
        r-icon.yellow.r-m-r-sm(icon="error_circle_rounded" size="lg")
        | {{ collection.playlistDuplicates.size }} playlist{{ collection.playlistDuplicates.size === 1 ? " has" : "s have" }} duplicate tracks
      .r-m-t-sm(v-for="playlist in collection.playlistDuplicates")
        .r-text-medium {{ playlist[0] }}
        .r-text-color-muted(v-for="track in playlist[1]") &bullet; {{ track }}
    h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
      r-icon.green.r-m-r-sm(icon="check" size="lg")
      | No duplicates in playlists

    .r-m-t-lg(v-if="collection.tracksProbableDuplicates.length")
      h2.r-text-md.r-text-medium
        r-icon.yellow.r-m-r-sm(icon="error_circle_rounded" size="lg")
        | {{ collection.tracksProbableDuplicates.length }} probable duplicate tracks
      .r-text-color-muted.r-m-t-sm You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can delete one of the files from collection.
      .r-buttons.r-m-t-md.r-m-b-md
        r-button(primary :action="actionDownloadDuplicateTracksPlaylist" :loading="state === 'LOADED_MODAL_OPEN'" icon="download") Export tracks
        r-button(gray :action="() => { $refs.duplicatesModal.open(); }") View list
        r-modal(ref="duplicatesModal" size="fill" title="Duplicate tracks" :buttons="false")
          .r-m-t-sm(v-for="tracks in collection.tracksProbableDuplicates")
            .r-text-bold {{ tracks[0].Artist }} - {{ tracks[0].Name }}
            .r-text-xxs.r-ellipsis(v-for="track in tracks")
              span.r-text-medium {{ formatSeconds(track.TotalTime) }}
              span.r-text-color-muted &nbsp;{{ track.Location.replaceAll("%26", "&").replaceAll("%20", " ").replace("file://localhost/", "") }}
    h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
      r-icon.green.r-m-r-sm(icon="check" size="lg")
      | No duplicates in collection

    .r-m-t-lg
    h2.r-text-md.r-text-medium
      r-icon.r-m-r-sm.gray(icon="delete_forever" size="lg")
      | Remove deleted files
    template(v-if="deletedTrackFiles.length")
      .r-text-color-muted.r-m-t-sm Nothing is actually deleted from this interface. Tracks are moved to folders KEEP and DELETE where you can either drag them back to your library or select all + really delete the files.
      .r-m-t-lg.r-m-b-md
        b Found {{ deletedTrackFiles.length }} files not in Rekordbox collection ({{ formatSizeToMB(deletedTrackFiles.reduce((prev: number, curr: FilePathWithSize) => prev + curr.size, 0)) }})
      .deleted-file.r-p-sm.r-background.r-border-radius-sm.r-m-b-sm(v-for="(file, i) in deletedTrackFiles" :class="{ selected: deletedTrackFileSelectedIndex === i }")
        .filename.r-text-medium(@click="() => deletedTrackFileSelectedIndex = i")
          .path.r-m-r-md(v-if="deletedTrackFileSelectedIndex === i") {{ file.path }}
          .path.r-m-r-md.r-ellipsis(v-else) ...\{{ file.path.split(String.fromCharCode(92)).slice(-2).join(String.fromCharCode(92)) }}
          .size.r-text-color-muted {{ formatSizeToMB(file.size) }}
        template(v-if="deletedTrackFileSelectedIndex === i")
          audio.r-m-t-sm(autoplay controls="true" :src="`file:///${file.path.replaceAll(String.fromCharCode(92), '/')}`" ref="audioPlayerRef")
          .r-buttons.r-m-t-sm
            r-button(icon="check" icon-color="green" :action="() => actionKeepTrackFile(file.path)") Keep
            r-button(icon="delete" icon-color="red" :action="() => actionDeleteTrackFile(file.path)") Delete
    template(v-else)
      .r-text-color-muted.r-m-t-sm Clean up track files from disk that have been removed from Rekordbox collection.
      .r-text-color-muted.r-m-t-sm This assumes your collection music files are in a single folder and it contains only music that should be or has been in your Rekordbox library.
      .r-m-t-sm
        b Nothing is deleted automatically, you can manually review the items after opening your collection folder.
      .r-buttons.r-m-t-md.r-m-b-md
        r-button(primary :action="actionFindDeletedTrackFiles" :loading="state === 'LOADING'" icon="folder_open") Open collection folder

.r-text-color-muted.r-p-sm.r-text-xxs Rekordfix v{{ version }}

</template>

<style lang="stylus">

.block-interface-cover
  position fixed
  top -20px
  bottom @top
  left @top
  right @top
  z-index 1
  background rgba(180, 180, 180, 0.3)
  backdrop-filter blur(20px)

  &:after
    content ""
    animation a .9s linear infinite
    border-radius 100%
    border 3px solid transparent
    border-right-color var(--c-text-muted)
    border-top-color var(--c-text-muted)
    height 60px
    width @height
    position absolute
    top "calc(50% - %s)" % (@height / 2)
    left @top

.deleted-file
  &.selected
    background var(--p-yellow-200)

    .r-button:hover
      background var(--p-gray-50)

  .filename
    cursor pointer
    display flex

    &:hover
      color var(--c-text-muted)

    .path
      flex 1 1 auto
      min-width 0

    .size
      flex 0 0 auto

  audio
    height 32px
    display block
    width 100%

    &::-webkit-media-controls-panel
      background-color var(--p-yellow-200)
      padding 0

    &::-webkit-media-controls-play-button
      background-color var(--p-green-300)
      border-radius 50%
</style>
