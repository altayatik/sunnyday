import type { WeatherSceneId } from '../types/weather';
import { readStorage, removeStorage, writeStorage } from './cache';

export type AdminSettings = {
  nightMode: 'auto' | 'day' | 'night';
  sceneOverride: 'auto' | WeatherSceneId;
  scoreOverride: number | null;
  debugLogging: boolean;
};

export const ADMIN_SETTINGS_KEY = 'sunnyday:admin-settings:v1';

export const defaultAdminSettings: AdminSettings = {
  nightMode: 'auto',
  sceneOverride: 'auto',
  scoreOverride: null,
  debugLogging: false,
};

export const readAdminSettings = (): AdminSettings => ({
  ...defaultAdminSettings,
  ...(readStorage<Partial<AdminSettings>>(ADMIN_SETTINGS_KEY) ?? {}),
});

export const saveAdminSettings = (settings: AdminSettings) => {
  writeStorage(ADMIN_SETTINGS_KEY, settings);
};

export const resetAdminSettings = () => {
  removeStorage(ADMIN_SETTINGS_KEY);
};
