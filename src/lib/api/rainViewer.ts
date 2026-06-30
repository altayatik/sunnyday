import type { RainViewerData } from '../../types/weather';
import { readCache, writeCache } from '../cache';

type RainViewerResponse = {
  host?: string;
  radar?: {
    past?: Array<{ time: number; path: string }>;
    nowcast?: Array<{ time: number; path: string }>;
  };
};

const TEN_MINUTES = 10 * 60 * 1000;

export const fetchRainViewer = async (): Promise<RainViewerData> => {
  const cacheKey = 'sunnyday:rainviewer';
  const cached = readCache<RainViewerData>(cacheKey);
  if (cached) return cached;

  const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!response.ok) throw new Error('RainViewer radar metadata failed.');

  const data = (await response.json()) as RainViewerResponse;
  const frames = [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])];
  const host = data.host ?? 'https://tilecache.rainviewer.com';
  const latestFrame = frames.at(-1) ?? null;

  const normalized = { host, frames, latestFrame };
  writeCache(cacheKey, normalized, TEN_MINUTES);
  return normalized;
};
