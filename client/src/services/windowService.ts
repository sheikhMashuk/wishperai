import { invoke } from '@tauri-apps/api/core';

export class WindowService {
  public static async toggleVisibility(): Promise<boolean> {
    try {
      return await invoke<boolean>('toggle_stealth_visibility');
    } catch (err) {
      console.warn('WindowService.toggleVisibility error:', err);
      return true;
    }
  }

  public static async hideWindow(): Promise<void> {
    try {
      await invoke('hide_stealth_window');
    } catch (err) {
      console.warn('WindowService.hideWindow error:', err);
    }
  }

  public static async showWindow(): Promise<void> {
    try {
      await invoke('show_stealth_window');
    } catch (err) {
      console.warn('WindowService.showWindow error:', err);
    }
  }

  public static async closeApp(): Promise<void> {
    try {
      await invoke('close_stealth_app');
    } catch (err) {
      console.warn('WindowService.closeApp error:', err);
      window.close();
    }
  }

  public static async setClickThrough(enable: boolean): Promise<void> {
    try {
      await invoke('set_stealth_clickthrough', { enable });
    } catch (err) {
      console.warn('WindowService.setClickThrough error:', err);
    }
  }
}
