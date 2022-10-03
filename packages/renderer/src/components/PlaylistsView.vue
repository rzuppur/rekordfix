<script lang="ts" setup>
import type {Ref} from 'vue';
import {ref} from 'vue';
import type {Playlist, TrackData} from '/@/model';

const props = defineProps<{
  collectionPlaylists: Playlist[];
  collectionTracks: TrackData[];
}>();

const playlistsModalRef: Ref = ref(null);
const playlistDetailModalRef: Ref = ref(null);

const open = () => {
  if (playlistsModalRef.value) playlistsModalRef.value.open();
};

const playlistTitle = ref('');
const playlistTracks: Ref<TrackData[]> = ref([]);

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
  playlistTracks.value = allTracks;
  playlistTitle.value = playlist.$.Name;
  if (playlistDetailModalRef.value) playlistDetailModalRef.value.open();
};

defineExpose({
  open,
});
</script>
<template lang="pug">

r-modal(ref="playlistsModalRef" size="fill" title="All playlists" :buttons="false")
  .r-m-t-xs(v-for="playlist in collectionPlaylists.sort((a, b) => a.$.Name.localeCompare(b.$.Name))")
    .r-flex-container
      .r-flex-1.ellipsis.r-text-medium(@click="() => { openPlaylist(playlist); }") {{ playlist.$.Name }}
      .r-flex-0.r-text-xxs
        template(v-if="playlist.TRACK") {{ playlist.TRACK.length }} track{{ playlist.TRACK.length === 1 ? "" : "s" }}
        template(v-else) empty
    hr

r-modal(ref="playlistDetailModalRef" size="fill" :title="playlistTitle" :buttons="false")
  .r-m-t-xs(v-for="tracks in playlistTracks")
    span.r-text-bold {{ tracks.Artist }}
    span.r-text-medium &nbsp;- {{ tracks.Name }}

</template>
