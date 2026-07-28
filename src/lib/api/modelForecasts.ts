import type { LocationResult, SunnyDaySummary } from '../../types/weather';
import { readCache, writeCache } from '../cache';
import { normalizeOpenMeteo } from '../weather/normalizeOpenMeteo';
import { dailyFields, hourlyFields } from './openMeteo';

const TEN_MINUTES = 10 * 60 * 1000;

export type ModelForecast = {
  id: string;
  label: string;
  /** Operating centre, so the model list reads as real institutions. */
  agency: string;
  /**
   * Relative confidence used to weight the consensus. ECMWF verifies best in
   * the medium range, GFS/ICON/UKMO next, then the remaining globals. These
   * are coarse on purpose: they order the models, they do not pretend to be
   * verification scores.
   */
  weight: number;
  summary: SunnyDaySummary;
};

export type ModelForecastDiagnostic = {
  id: string;
  label: string;
  agency: string;
  status: 'ok' | 'error';
  durationMs: number;
  message: string;
};

export type ModelForecastBatch = {
  forecasts: ModelForecast[];
  diagnostics: ModelForecastDiagnostic[];
};

/**
 * Seven independent global NWP systems. All are reached through Open-Meteo,
 * but each is a genuinely separate model run by a different meteorological
 * agency, which is what makes the spread between them meaningful.
 *
 * Any model can be missing for a given point or lead time; `fetchModelForecasts`
 * keeps whatever succeeds rather than failing the whole comparison.
 */
export const forecastModels = [
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS', agency: 'European Centre', weight: 1.25 },
  { id: 'gfs_seamless', label: 'NOAA GFS', agency: 'United States', weight: 1.1 },
  { id: 'icon_seamless', label: 'DWD ICON', agency: 'Germany', weight: 1.1 },
  { id: 'ukmo_seamless', label: 'UKMO', agency: 'United Kingdom', weight: 1 },
  { id: 'meteofrance_seamless', label: 'Météo-France', agency: 'France', weight: 0.9 },
  { id: 'gem_seamless', label: 'ECCC GEM', agency: 'Canada', weight: 0.9 },
  { id: 'jma_seamless', label: 'JMA GSM', agency: 'Japan', weight: 0.8 },
] as const;

export type ForecastModelDefinition = (typeof forecastModels)[number];

const fetchModel = async (
  model: ForecastModelDefinition,
  location: LocationResult,
  selectedDate: string | undefined,
  signal?: AbortSignal,
): Promise<ModelForecast> => {
  const dateKey = selectedDate ?? 'today';
  const cacheKey = `sunnyday:model:v2:${model.id}:${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}:${dateKey}`;
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
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error(`${model.label} forecast failed.`);

  const summary = normalizeOpenMeteo(await response.json(), location, selectedDate);

  // A model can answer 200 with an all-null series when the selected day sits
  // outside its run length. Treat that as unavailable rather than letting a
  // hollow forecast dilute the consensus.
  const usableHours = summary.scoringHourly.filter(
    (hour) => hour.temperatureF !== null || hour.precipitationProbability !== null,
  ).length;
  // Late in the evening there may legitimately be only one or two hours left
  // in the selected day. Requiring three hours made every healthy model look
  // broken after 10 PM and disabled consensus precisely when the app was
  // switching into its night presentation.
  if (usableHours === 0) throw new Error(`${model.label} returned no usable hours.`);

  writeCache(cacheKey, summary, TEN_MINUTES);
  return { ...model, summary };
};

export const fetchModelForecastBatch = async (
  location: LocationResult,
  selectedDate?: string,
  signal?: AbortSignal,
): Promise<ModelForecastBatch> => {
  const results = await Promise.allSettled(
    forecastModels.map(async (model) => {
      const startedAt = performance.now();
      try {
        const forecast = await fetchModel(model, location, selectedDate, signal);
        return {
          forecast,
          diagnostic: {
            id: model.id,
            label: model.label,
            agency: model.agency,
            status: 'ok' as const,
            durationMs: Math.round(performance.now() - startedAt),
            message: `${forecast.summary.scoringHourly.length} forecast hours available`,
          },
        };
      } catch (caught) {
        throw {
          diagnostic: {
            id: model.id,
            label: model.label,
            agency: model.agency,
            status: 'error' as const,
            durationMs: Math.round(performance.now() - startedAt),
            message: caught instanceof Error ? caught.message : 'Model request failed.',
          },
        };
      }
    }),
  );

  return {
    forecasts: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value.forecast] : [])),
    diagnostics: results.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value.diagnostic
        : ((result.reason as { diagnostic?: ModelForecastDiagnostic }).diagnostic ?? {
            id: forecastModels[index].id,
            label: forecastModels[index].label,
            agency: forecastModels[index].agency,
            status: 'error',
            durationMs: 0,
            message: 'Model request failed.',
          }),
    ),
  };
};

/** Kept for callers that only need the successful model summaries. */
export const fetchModelForecasts = async (
  location: LocationResult,
  selectedDate?: string,
  signal?: AbortSignal,
): Promise<ModelForecast[]> => (await fetchModelForecastBatch(location, selectedDate, signal)).forecasts;
