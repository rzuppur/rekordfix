<script lang="ts" setup>
import type { Ref } from "vue";
import type { Playlist, TrackData, PlaylistData } from "../../../main/src/rekordbox/model";

import { ref } from "vue";

const props = defineProps<{
  collectionPlaylists: Playlist[];
  collectionTracks: TrackData[];
}>();

const emit = defineEmits(["back", "downloadPlaylist"]);

const activePlaylist: Ref<PlaylistData | null> = ref(null);
const playlistTracks: Ref<TrackData[] | null> = ref(null);

const openPlaylist = (playlist: Playlist) => {
  const allTracks = [];
  if (props.collectionTracks && props.collectionTracks.length && playlist.TRACK && playlist.TRACK.length) {
    for (const track of playlist.TRACK) {
      const trackData = props.collectionTracks.find((t) => t.TrackID === track.$.Key);
      if (trackData) allTracks.push(trackData);
    }
  }
  activePlaylist.value = playlist.$;
  playlistTracks.value = allTracks;
  window.scrollTo(0, 0);
};

const closePlaylist = () => {
  activePlaylist.value = null;
  playlistTracks.value = null;
};
</script>

<template lang="pug">

template(v-if="activePlaylist && playlistTracks")
  r-button.r-m-b-md(:action="closePlaylist" icon="arrow_back") Back
  h1.r-text-md.r-text-bold {{ activePlaylist.Name }}
  .r-text-color-muted.r-m-b-md.r-m-t-xs {{ activePlaylist.Entries }} tracks &middot;&nbsp;
    a(@click="() => emit('downloadPlaylist', activePlaylist.Name)") Download
  table.playlist-contents
    thead
      tr
        th Track
        th Artist
        th.r-ellipsis BPM
    tbody
      tr.r-m-t-xs(v-for="tracks in playlistTracks")
        td.r-text-medium {{ tracks.Name }}
        td {{ tracks.Artist || 'Unknown Artist' }}
        td.r-ellipsis {{ Math.round(+tracks.AverageBpm) }}

template(v-else)
  r-button.r-m-b-md(:action="() => { emit('back'); }" icon="arrow_back") Back
  h1.r-text-md.r-m-b-md.r-text-bold All playlists
  .r-m-t-xs(v-for="playlist in collectionPlaylists")
    .r-flex-container.playlist-row(@click="() => { openPlaylist(playlist); }")
      .r-flex-1.ellipsis.r-text-medium {{ playlist.$.Name }}
      .r-flex-0.r-text-xxs
        template(v-if="playlist.TRACK") {{ playlist.TRACK.length }} track{{ playlist.TRACK.length === 1 ? '' : 's' }}
        template(v-else) empty

</template>

<style lang="stylus">

table.playlist-contents
  border-collapse collapse

  td,
  th
    text-align left
    padding 4px 6px
    border 1px solid var(--c-border-medium)

.playlist-row
  cursor pointer

  &:hover
    background var(--c-background)
</style>
