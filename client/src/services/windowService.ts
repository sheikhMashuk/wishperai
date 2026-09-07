import { invoke } from '@tauri-apps/api/core';

const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const windowService = {
  async setClickThrough(enable: boolean) {
    if (!inTauri()) return;
    await invoke('set_stealth_clickthrough', { enable }).catch((e) => console.warn('setClickThrough', e));
  },
  async hide() {
    if (!inTauri()) return;
    await invoke('hide_stealth_window').catch((e) => console.warn('hide', e));
  },
  async quit() {
    if (!inTauri()) {
      window.close();
      return;
    }
    await invoke('close_stealth_app').catch((e) => console.warn('quit', e));
  },
  async getApiKey(): Promise<string> {
    if (!inTauri()) return '';
    return invoke<string>('get_api_key').catch(() => '');
  },
  async setApiKey(key: string) {
    if (!inTauri()) return;
    await invoke('set_api_key', { key }).catch((e) => console.warn('setApiKey', e));
  },
};
