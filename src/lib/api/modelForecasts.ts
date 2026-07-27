import type { LocationResult, SunnyDaySummary } from '../../types/weather';
import { readCache, writeCache } from '../cache';
import { normalizeOpenMeteo } from '../weather/normalizeOpenMeteo';
import { dailyFields, hourlyFields } from './openMeteo';

const TEN_MINUTES = 10 * 60 * 1000;

export type ModelForecast = {
  id: string;
  label: string;
  summary: SunnyDaySummary;
};

export const forecastModels = [
  { id: 'gfs_seamless', label: 'NOAA GFS' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS' },
  { id: 'icon_seamless', label: 'DWD ICON' },
] as const;

const fetchModel = async (
  model: (typeof forecastModels)[number],
  location: LocationResult,
  selectedDate?: string,
): Promise<ModelForecast> => {
  const dateKey = selectedDate ?? 'today';
  const cacheKey = `sunnyday:model:v1:${model.id}:${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}:${dateKey}`;
  const cached = readCache<SunnyDaySummary>(cacheKey);
  if (cached) return { ...model, summary: cached };

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: hourlyFields.join(','),
    daily: dailyFields.join(','),
    models: model.id,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: '7',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`${model.label} forecast failed.`);

  const summary = normalizeOpenMeteo(await response.json(), location, selectedDate);
  writeCache(cacheKey, summary, TEN_MINUTES);
  return { ...model, summary };
};

export const fetchModelForecasts = async (location: LocationResult, selectedDate?: string): Promise<ModelForecast[]> => {
  const results = await Promise.allSettled(forecastModels.map((model) => fetchModel(model, location, selectedDate)));
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
};
