<script lang="ts" setup>
  import {collectionOpen, downloadPlaylist, getVersion} from "#preload";
  import type {Ref} from "vue";
  import {ref} from "vue";
  import type {ParsedCollectionData} from "../../main/src/rekordbox/model";
  import {useToast} from "@rzuppur/rvc";
  import {cleanLocationString, formatSeconds} from "/@/utils";
  import PlaylistsView from "/@/components/PlaylistsView.vue";

  const toast = useToast();

  // STATE & DATA
  const collectionLoading = ref(false);
  const errorText = ref("");
  const playlistSaving = ref(false);
  const playlistsOpen = ref(false);
  const parsedCollection: Ref<ParsedCollectionData | null> = ref(null);

  const resetState = () => {
    errorText.value = "";
    collectionLoading.value = false;
    parsedCollection.value = null;
  };

  const actionOpenCollection = async () => {
    resetState();
    collectionLoading.value = true;

    try {
      const collection = await collectionOpen();
      if ("error" in collection) return toast(`❌ ${collection.error}`);
      parsedCollection.value = collection;
    } catch (e) {
      console.error(e);
      toast("❌ " + e);
      errorText.value = "Error reading the file, make sure you followed the instructions above.";
    } finally {
      collectionLoading.value = false;
    }
  };

  const actionSaveLostPlaylist = async () => {
    if (!parsedCollection.value) return;
    playlistSaving.value = true;
    let m3u8 = "#EXTM3U\n";
    parsedCollection.value.tracksNotInPlaylists.forEach(track => {
      m3u8 += `#EXTINF:${track.TotalTime},${track.Artist} - ${track.Name}\n`;
      m3u8 += `${cleanLocationString(track.Location)}\n`;
    });
    const result = await downloadPlaylist(m3u8, "lost_tracks");
    if ("success" in result) toast(`✔ Playlist saved to ${result.path}`);
    else if ("canceled" in result) toast("Dialogue canceled");
    else toast(`❌ ${result.error}`);
    playlistSaving.value = false;
  };

  const actionSaveDuplicatePlaylist = async () => {
    if (!parsedCollection.value) return;
    playlistSaving.value = true;
    let m3u8 = "#EXTM3U\n";
    for (const duplicateTracks of parsedCollection.value.tracksProbableDuplicates) {
      for (const track of duplicateTracks) {
        m3u8 += `#EXTINF:${track.TotalTime},${track.Artist} - ${track.Name}\n`;
        m3u8 += `${cleanLocationString(track.Location)}\n`;
      }
    }

    const path = await downloadPlaylist(m3u8, "duplicate_tracks");
    if (path) toast(`✔ Playlist saved to ${path}`);
    playlistSaving.value = false;
  };

  const version = ref("");
  (async () => {
    version.value = await getVersion();
  })();
</script>

<template lang="pug">

.r-text-xs.r-p-b-lg.r-background-raised
  .r-p-lg(v-if="!parsedCollection")
    p Open your collection export to get started.
    ul.r-space
      li Go to Rekordbox
      li Select #{""}
        b File > Export Collection in xml format
      li Open the file you just exported
    r-button.r-m-t-lg(primary :loading="collectionLoading" icon="file_open" :action="actionOpenCollection") Open XML Collection File
    .background-error.r-p-md.r-border-radius-md.r-text-color-red.r-text-medium.r-space(v-if="errorText") {{ errorText }}

  .r-p-lg(v-else)

    template(v-if="playlistsOpen")
      PlaylistsView(:collectionPlaylists="parsedCollection.playlists" :collectionTracks="parsedCollection.tracks" @back="() => { playlistsOpen = false; }")

    template(v-else)
      r-button.r-m-b-md(:action="resetState" icon="arrow_back") Back

      .r-p-sm.r-background.r-border-radius-sm
        .r-text-xxs.r-text-bold {{ parsedCollection.path }}
        .r-text-xxs.r-text-color-muted Rekordbox version {{ parsedCollection.version }} &middot; {{parsedCollection.tracks.length }} tracks &middot;&nbsp;
          a(@click="() => { playlistsOpen = true; }") {{ parsedCollection.playlists.length }} playlists
        .r-text-xxs.r-text-color-muted Last track added: "{{ parsedCollection.tracks.slice(-1)[0].Name }}" on {{ parsedCollection.tracks.slice(-1)[0].DateAdded }}

      .r-m-t-lg(v-if="parsedCollection.tracksNotInPlaylists.length")
        h2.r-text-md.r-text-medium
          r-icon.yellow.r-m-r-sm(icon="error_circle_rounded" size="lg")
          | {{ parsedCollection.tracksNotInPlaylists.length }} lost track{{ parsedCollection.tracksNotInPlaylists.length === 1 ? '' : 's' }}
        .r-text-color-muted.r-m-t-xs These tracks are in collection but weren't found in any playlist. You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can either add them to a playlist or delete from collection.
        r-button.r-m-t-md(primary :action="actionSaveLostPlaylist" :loading="playlistSaving" icon="download") Export tracks
      h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
        r-icon.green.r-m-r-sm(icon="check" size="lg")
        | All collection tracks are in playlists

      .r-m-t-lg(v-if="parsedCollection.playlistDuplicates.size")
        h2.r-text-md.r-text-medium
          r-icon.yellow.r-m-r-sm(icon="error_circle_rounded" size="lg")
          | {{ parsedCollection.playlistDuplicates.size }} playlist{{ parsedCollection.playlistDuplicates.size === 1 ? " has" : "s have" }} duplicate tracks
        .r-m-t-sm(v-for="playlist in parsedCollection.playlistDuplicates")
          .r-text-medium {{ playlist[0] }}
          .r-text-color-muted(v-for="track in playlist[1]") &bullet; {{ track }}
      h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
        r-icon.green.r-m-r-sm(icon="check" size="lg")
        | No duplicates in playlists

      .r-m-t-lg(v-if="parsedCollection.tracksProbableDuplicates.length")
        h2.r-text-md.r-text-medium
          r-icon.yellow.r-m-r-sm(icon="error_circle_rounded" size="lg")
          | {{ parsedCollection.tracksProbableDuplicates.length }} probable duplicate tracks
        .r-text-color-muted.r-m-t-xs You can save these tracks to a m3u8 playlist that can be imported to Rekordbox. There you can delete one of the files from collection.
        .r-buttons.r-m-t-md.r-m-b-md
          r-button(primary :action="actionSaveDuplicatePlaylist" :loading="playlistSaving" icon="download") Export tracks
          r-button(gray :action="() => { $refs.duplicatesModal.open(); }") View list
          r-modal(ref="duplicatesModal" size="fill" title="Duplicate tracks" :buttons="false")
            .r-m-t-sm(v-for="tracks in parsedCollection.tracksProbableDuplicates")
              .r-text-bold {{ tracks[0].Artist }} - {{ tracks[0].Name }}
              .r-text-xxs.r-ellipsis(v-for="track in tracks")
                span.r-text-medium {{ formatSeconds(track.TotalTime) }}
                span.r-text-color-muted &nbsp;{{ cleanLocationString(track.Location).replace("file://localhost/", "") }}
      h2.r-text-md.r-text-medium.r-m-t-lg(v-else)
        r-icon.green.r-m-r-sm(icon="check" size="lg")
        | No duplicates in collection

.r-text-color-muted.r-p-sm.r-text-xxs Rekordfix v{{ version }}

</template>
