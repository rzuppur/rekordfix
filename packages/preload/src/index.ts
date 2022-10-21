/**
 * @module preload
 */
import type {Collection} from '../../renderer/src/model';

export {versions} from './versions';
const {ipcRenderer} = require('electron');

export function openXML(): Promise<{xml: Collection; path: string, cancelled?: boolean}> {
  return ipcRenderer.invoke('dialog:openFile');
}

export function downloadPlaylist(content: string, filename: string): Promise<string | undefined> {
  return ipcRenderer.invoke('downloadPlaylist', content, filename);
}
