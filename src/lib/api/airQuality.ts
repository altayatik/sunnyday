import type { AirQualityData, LocationResult, PollenKind, PollenReading } from '../../types/weather';
import { readCache, writeCache } from '../cache';
import { dateKeyInTimeZone } from '../date';

const THIRTY_MINUTES = 30 * 60 * 1000;

const hourlyFields = [
  'pm10',
  'pm2_5',
  'nitrogen_dioxide',
  'ozone',
  'us_aqi',
  'european_aqi',
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen',
];

/**
 * US AQI breakpoint categories. Open-Meteo returns the composite index
 * directly, so we only need to name the band rather than recompute it from
 * concentrations.
 */
const aqiCategory = (aqi: number | null): { label: string; level: number } => {
  if (aqi === null) return { label: 'Unknown', level: 0 };
  if (aqi <= 50) return { label: 'Good', level: 1 };
  if (aqi <= 100) return { label: 'Moderate', level: 2 };
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', level: 3 };
  if (aqi <= 200) return { label: 'Unhealthy', level: 4 };
  if (aqi <= 300) return { label: 'Very unhealthy', level: 5 };
  return { label: 'Hazardous', level: 6 };
};

/**
 * Pollen thresholds follow the CAMS grains/m3 bands that Open-Meteo
 * documents. Tree, grass, and weed pollen use different scales, so each
 * species carries its own breakpoints rather than sharing one.
 */
const pollenScales: Record<PollenKind, { label: string; bands: [number, number, number] }> = {
  alder: { label: 'Alder', bands: [10, 50, 200] },
  birch: { label: 'Birch', bands: [10, 50, 200] },
  grass: { label: 'Grass', bands: [5, 20, 50] },
  mugwort: { label: 'Mugwort', bands: [5, 20, 50] },
  olive: { label: 'Olive', bands: [10, 50, 200] },
  ragweed: { label: 'Ragweed', bands: [5, 20, 50] },
};

const pollenLevelLabels = ['None', 'Low', 'Moderate', 'High', 'Very high'];

const readPollen = (kind: PollenKind, value: number | null): PollenReading | null => {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  const { label, bands } = pollenScales[kind];
  const level = value >= bands[2] ? 4 : value >= bands[1] ? 3 : value >= bands[0] ? 2 : 1;
  return {
    kind,
    label,
    grainsPerM3: Math.round(value),
    level,
    levelLabel: pollenLevelLabels[level],
  };
};

type AirQualityResponse = {
  hourly?: Record<string, Array<number | string | null>>;
};

const numberAt = (values: Array<number | string | null> | undefined, index: number): number | null => {
  const value = values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

/**
 * The air-quality endpoint is a separate Open-Meteo service with its own
 * host and its own coverage. Pollen in particular is only modelled over
 * Europe (CAMS Europe), so `pollenAvailable` stays false elsewhere instead
 * of the UI implying a zero reading means "no pollen today".
 */
export const fetchAirQuality = async (
  location: LocationResult,
  selectedDate?: string,
  now = new Date(),
): Promise<AirQualityData> => {
  const dateKey = selectedDate ?? dateKeyInTimeZone(now, location.timezone);
  const cacheKey = `sunnyday:air:v1:${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}:${dateKey}`;
  const cached = readCache<AirQualityData>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: hourlyFields.join(','),
    timezone: 'auto',
    forecast_days: '5',
  });

  const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
  if (!response.ok) throw new Error('Air quality lookup failed.');

  const data = (await response.json()) as AirQualityResponse;
  const hourly = data.hourly ?? {};
  const times = (hourly.time ?? []) as string[];
  if (!times.length) throw new Error('Air quality returned no hourly data.');

  const dayIndices = times
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time.startsWith(dateKey))
    .map(({ index }) => index);
  const indices = dayIndices.length ? dayIndices : times.map((_, index) => index).slice(0, 24);

  // Reference hour: the current hour when looking at today, otherwise
  // midday, which is when people actually decide whether to go outside.
  const currentHourKey = `${dateKeyInTimeZone(now, location.timezone)}T${String(now.getHours()).padStart(2, '0')}`;
  const referenceIndex =
    indices.find((index) => times[index].slice(0, 13) >= currentHourKey) ??
    indices.find((index) => times[index].slice(11, 13) === '12') ??
    indices[0];

  const usAqiSeries = indices.map((index) => numberAt(hourly.us_aqi, index)).filter((v): v is number => v !== null);
  const usAqi = numberAt(hourly.us_aqi, referenceIndex);
  const peakAqi = usAqiSeries.length ? Math.max(...usAqiSeries) : null;
  const category = aqiCategory(usAqi ?? peakAqi);

  const pm25 = numberAt(hourly.pm2_5, referenceIndex);
  const pm10 = numberAt(hourly.pm10, referenceIndex);
  const ozone = numberAt(hourly.ozone, referenceIndex);
  const nitrogenDioxide = numberAt(hourly.nitrogen_dioxide, referenceIndex);

  // Rough attribution: whichever pollutant sits highest against its own
  // 24-hour US AQI "unhealthy for sensitive groups" breakpoint.
  const pollutantLoads: Array<{ name: string; load: number }> = [
    { name: 'PM2.5', load: pm25 === null ? -1 : pm25 / 35.4 },
    { name: 'PM10', load: pm10 === null ? -1 : pm10 / 154 },
    { name: 'Ozone', load: ozone === null ? -1 : ozone / 164 },
    { name: 'NO₂', load: nitrogenDioxide === null ? -1 : nitrogenDioxide / 360 },
  ];
  const leading = pollutantLoads.sort((a, b) => b.load - a.load)[0];
  const dominantPollutant = leading && leading.load > 0 ? leading.name : null;

  const pollenKinds: PollenKind[] = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];
  const pollenAvailable = pollenKinds.some((kind) =>
    indices.some((index) => numberAt(hourly[`${kind}_pollen`], index) !== null),
  );
  const pollen = pollenKinds
    .map((kind) => {
      const peak = indices
        .map((index) => numberAt(hourly[`${kind}_pollen`], index))
        .filter((value): value is number => value !== null);
      return peak.length ? readPollen(kind, Math.max(...peak)) : null;
    })
    .filter((reading): reading is PollenReading => reading !== null)
    .sort((a, b) => b.level - a.level || b.grainsPerM3 - a.grainsPerM3);

  const result: AirQualityData = {
    usAqi,
    europeanAqi: numberAt(hourly.european_aqi, referenceIndex),
    category: category.label,
    categoryLevel: category.level,
    pm25,
    pm10,
    ozone,
    nitrogenDioxide,
    peakAqi,
    dominantPollutant,
    pollen,
    peakPollen: pollen[0] ?? null,
    pollenAvailable,
  };

  writeCache(cacheKey, result, THIRTY_MINUTES);
  return result;
};
