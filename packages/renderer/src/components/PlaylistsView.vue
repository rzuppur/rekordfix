<script lang="ts" setup>
  import type {Ref} from "vue";
  import {ref} from "vue";
  import type {Playlist, TrackData} from "/@/model";

  const props = defineProps<{
    collectionPlaylists: Playlist[];
    collectionTracks: TrackData[];
  }>();

  const emit = defineEmits(["back"]);

  const playlistTitle = ref("");
  const playlistTracks: Ref<TrackData[] | null> = ref(null);

  const openPlaylist = (playlist: Playlist) => {
    const allTracks = [];
    if (
      props.collectionTracks &&
      props.collectionTracks.length &&
      playlist.TRACK &&
      playlist.TRACK.length
    ) {
      for (const track of playlist.TRACK) {
        const trackData = props.collectionTracks.find(t => t.TrackID === track.$.Key);
        if (trackData) allTracks.push(trackData);
      }
    }
    playlistTitle.value = playlist.$.Name;
    playlistTracks.value = allTracks;
    window.scrollTo(0, 0);
  };

  const closePlaylist = () => {
    playlistTitle.value = "";
    playlistTracks.value = null;
  };
</script>

<template lang="pug">

template(v-if="playlistTracks")
  r-button.r-m-b-md(:action="closePlaylist" icon="arrow_back") Back
  h1.r-text-md.r-m-b-md.r-text-bold {{ playlistTitle }}
  .r-m-t-xs(v-for="tracks in playlistTracks")
    span.r-text-medium {{ tracks.Artist }}
    span.r-text-color-muted &nbsp;- {{ tracks.Name }}

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

  .playlist-row
    cursor pointer

    &:hover
      background var(--c-background)
</style>
