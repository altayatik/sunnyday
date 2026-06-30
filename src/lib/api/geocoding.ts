import type { LocationResult } from '../../types/weather';
import { readCache, writeCache } from '../cache';

type GeocodingResponse = {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    country_code?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

const TEN_MINUTES = 10 * 60 * 1000;

export const searchLocations = async (query: string): Promise<LocationResult[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `sunnyday:geo:${trimmed.toLowerCase()}`;
  const cached = readCache<LocationResult[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    name: trimmed,
    count: '10',
    language: 'en',
    format: 'json',
  });

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!response.ok) throw new Error('Location search failed.');

  const data = (await response.json()) as GeocodingResponse;
  const results = (data.results ?? [])
    .sort((a, b) => Number(b.country_code === 'US') - Number(a.country_code === 'US'))
    .map((result) => ({
      name: result.name,
      admin1: result.admin1,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
    }));

  writeCache(cacheKey, results, TEN_MINUTES);
  return results;
};

export const reverseGeocodeFallback = (latitude: number, longitude: number): LocationResult => ({
  name: 'Current location',
  admin1: undefined,
  country: 'United States',
  latitude,
  longitude,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});
