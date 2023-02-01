<script lang="ts" setup>
  import type {ParsedCollectionData} from "../../main/src/rekordbox/model";
  import type {Ref} from "vue";
  import {collectionOpen, downloadPlaylist, getVersion} from "#preload";
  import {reactive, ref, watchEffect} from "vue";
  import {useToast} from "@rzuppur/rvc";
  import {cleanLocationString, formatSeconds} from "/@/utils";
  import PlaylistsView from "/@/components/PlaylistsView.vue";

  // COMMUNICATION
  const toast = useToast();
  const onError = (error: unknown) => {
    console.error(error);
    toast(`❌ ${error}`);
  };

  // STATE & DATA
  let collection: ParsedCollectionData | Record<string, never> = reactive({});
  const state: Ref<"UNLOADED" | "LOADING" | "LOADED" | "SAVING" | "PLAYLIST_DETAILS"> = ref("UNLOADED");
  watchEffect(() => {
    console.log(state.value);
  });

  const resetCollection = () => {
    state.value = "UNLOADED";
    for (const key of Object.keys(collection)) {
      delete (collection as Record<string, unknown>)[key];
    }
  };

  const actionOpenCollection = async () => {
    state.value = "LOADING";

    try {
      const response = await collectionOpen();
      if ("error" in response) throw new Error(response.error);
      for (const key of Object.keys(response)) {
        (collection as Record<string, unknown>)[key] = response[key as keyof ParsedCollectionData];
      }
      state.value = "LOADED";
    } catch (e) {
      onError(e);
      resetCollection();
    }
  };

  const actionSaveLostPlaylist = async () => {
    if (state.value !== "LOADED") return;
    state.value = "SAVING";

    try {
      let m3u8 = "#EXTM3U\n";
      collection.tracksNotInPlaylists.forEach(track => {
        m3u8 += `#EXTINF:${track.TotalTime},${track.Artist} - ${track.Name}\n`;
        m3u8 += `${cleanLocationString(track.Location)}\n`;
      });
      const result = await downloadPlaylist(m3u8, "lost_tracks");
      if ("success" in result) {
        toast(`✔ Playlist saved to ${result.path}`);
      } else if ("canceled" in result) {
        toast("Dialogue canceled");
      } else {
        onError(result.error);
      }
    } finally {
      state.value = "LOADED";
    }
  };

  const actionSaveDuplicatePlaylist = async () => {
    if (state.value !== "LOADED") return;
    state.value = "SAVING";

    try {
      let m3u8 = "#EXTM3U\n";
      for (const duplicateTracks of collection.tracksProbableDuplicates) {
        for (const track of duplicateTracks) {
          m3u8 += `#EXTINF:${track.TotalTime},${track.Artist} - ${track.Name}\n`;
          m3u8 += `${cleanLocationString(track.Location)}\n`;
        }
      }
      const path = await downloadPlaylist(m3u8, "duplicate_tracks");
      if (path) toast(`✔ Playlist saved to ${path}`);
    } finally {
      state.value = "LOADED";
    }
  };

  // GET APP VERSION
  const version = ref("");
  (async () => {
    version.value = await getVersion();
  })();
</script>

<template lang="pug">

.r-text-xs.r-p-b-lg.r-background-raised

  .block-interface-cover(v-if="state === 'LOADING'")
  .block-interface-cover(v-if="state === 'SAVING'")

  .r-p-lg(v-if="state === 'UNLOADED' || state === 'LOADING'")
    p Open your collection export to get started.
    ul.r-space
      li Go to Rekordbox
      li Select #{""}
        b File > Export Collection in xml format
      li Open the file you just exported
    r-button.r-m-t-lg(primary :loading="state === 'LOADING'" icon="file_open" :action="actionOpenCollection") Open XML Collection File

  .r-p-lg(v-else-if="state === 'PLAYLIST_DETAILS'")
    PlaylistsView(:collectionPlaylists="collection.playlists" :collectionTracks="collection.tracks" @back="() => { state = 'LOADED'; }")

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
        | {{ collection.tracksNotInPlaylists.length }} lost track{{ collection.tracksNotInPlaylists.length === 1 ? '' : 's' }}
      .r-text-color-muted.r-m-t-xs These tracks are in collection but weren't found in any playlist. You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can either add them to a playlist or delete from collection.
      r-button.r-m-t-md(primary :action="actionSaveLostPlaylist" :loading="state === 'SAVING'" icon="download") Export tracks
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
      .r-text-color-muted.r-m-t-xs You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can delete one of the files from collection.
      .r-buttons.r-m-t-md.r-m-b-md
        r-button(primary :action="actionSaveDuplicatePlaylist" :loading="state === 'SAVING'" icon="download") Export tracks
        r-button(gray :action="() => { $refs.duplicatesModal.open(); }") View list
        r-modal(ref="duplicatesModal" size="fill" title="Duplicate tracks" :buttons="false")
          .r-m-t-sm(v-for="tracks in collection.tracksProbableDuplicates")
            .r-text-bold {{ tracks[0].Artist }} - {{ tracks[0].Name }}
            .r-text-xxs.r-ellipsis(v-for="track in tracks")
              span.r-text-medium {{ formatSeconds(track.TotalTime) }}
              span.r-text-color-muted &nbsp;{{ cleanLocationString(track.Location).replace("file://localhost/", "") }}
    h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
      r-icon.green.r-m-r-sm(icon="check" size="lg")
      | No duplicates in collection

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

</style>
