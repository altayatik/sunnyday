import type { LocationResult, SunnyDaySummary } from '../../types/weather';
import { readCache, writeCache } from '../cache';
import { normalizeOpenMeteo } from '../weather/normalizeOpenMeteo';

const TEN_MINUTES = 10 * 60 * 1000;

const hourlyFields = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'rain',
  'showers',
  'weather_code',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'wind_speed_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
  'visibility',
];

const dailyFields = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'precipitation_sum',
  'sunrise',
  'sunset',
  'daylight_duration',
  'sunshine_duration',
  'uv_index_max',
];

export const fetchSunnyForecast = async (location: LocationResult, selectedDate?: string): Promise<SunnyDaySummary> => {
  const roundedLat = location.latitude.toFixed(3);
  const roundedLon = location.longitude.toFixed(3);
  const dateKey = selectedDate ?? 'today';
  const cacheKey = `sunnyday:forecast:v7:${roundedLat},${roundedLon}:${dateKey}`;
  const cached = readCache<SunnyDaySummary>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: hourlyFields.join(','),
    daily: dailyFields.join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: '7',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error('Open-Meteo forecast failed.');

  const data = await response.json();
  const normalized = normalizeOpenMeteo(data, location, selectedDate);

  writeCache(cacheKey, normalized, TEN_MINUTES);
  return normalized;
};
