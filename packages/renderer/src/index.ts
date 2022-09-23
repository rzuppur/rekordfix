import {createApp} from 'vue';
import App from '/@/App.vue';
import rvc from '@rzuppur/rvc';
import './main.styl';

const app = createApp(App);
app.use(rvc);

app.mount('#app');
