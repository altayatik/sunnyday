import type {
  AirQualityData,
  DailySunnyData,
  HourlySunnyData,
  LocationResult,
  NwsAlert,
  SunnyDaySummary,
} from '../../types/weather';
import { conditionFromWeather } from './weatherCodes';
import { applyAlertScoreCap, applyWeatherScoreCap, labelForScore, scoreSunnyDay } from './sunnyDayScore';
import { round } from './units';
import { buildSummaryText } from './summaries';
import { buildInsights } from './insights';
import { deriveScene } from './weatherScene';
import { dateKeyInTimeZone } from '../date';
import { stabiliseScore } from './scoreStability';

type OpenMeteoForecast = {
  latitude: number;
  longitude: number;
  timezone?: string;
  hourly?: Record<string, Array<number | string | null>>;
  daily?: Record<string, Array<number | string | null>>;
};

const valueAt = <T>(values: T[] | undefined, index: number): T | null => values?.[index] ?? null;

const hourKeyInTimeZone = (date: Date, timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}`;
};

const buildHourly = (forecast: OpenMeteoForecast): HourlySunnyData[] => {
  const hourly = forecast.hourly ?? {};
  const times = (hourly.time ?? []) as string[];

  return times.map((time, index) => {
    const weatherCode = valueAt(hourly.weather_code as number[] | undefined, index);
    const cloudCover = valueAt(hourly.cloud_cover as number[] | undefined, index);
    const isDayValue = valueAt(hourly.is_day as number[] | undefined, index);
    const condition = conditionFromWeather(weatherCode, cloudCover, isDayValue === null ? null : isDayValue === 1);

    return {
      time,
      temperatureF: round(valueAt(hourly.temperature_2m as number[] | undefined, index)),
      apparentTemperatureF: round(valueAt(hourly.apparent_temperature as number[] | undefined, index)),
      humidity: round(valueAt(hourly.relative_humidity_2m as number[] | undefined, index)),
      precipitationProbability: round(valueAt(hourly.precipitation_probability as number[] | undefined, index)),
      precipitationInches: round(valueAt(hourly.precipitation as number[] | undefined, index), 3),
      rainInches: round(valueAt(hourly.rain as number[] | undefined, index), 3),
      showersInches: round(valueAt(hourly.showers as number[] | undefined, index), 3),
      cloudCover,
      lowCloudCover: round(valueAt(hourly.cloud_cover_low as number[] | undefined, index)),
      midCloudCover: round(valueAt(hourly.cloud_cover_mid as number[] | undefined, index)),
      highCloudCover: round(valueAt(hourly.cloud_cover_high as number[] | undefined, index)),
      uvIndex: round(valueAt(hourly.uv_index as number[] | undefined, index), 1),
      windSpeedMph: round(valueAt(hourly.wind_speed_10m as number[] | undefined, index)),
      windGustMph: round(valueAt(hourly.wind_gusts_10m as number[] | undefined, index)),
      weatherCode,
      isDay: isDayValue === null ? null : isDayValue === 1,
      visibilityMeters: round(valueAt(hourly.visibility as number[] | undefined, index)),
      conditionLabel: condition.label,
      conditionIcon: condition.icon,
    };
  });
};

const buildDaily = (forecast: OpenMeteoForecast): DailySunnyData[] => {
  const daily = forecast.daily ?? {};
  const dates = (daily.time ?? []) as string[];

  return dates.map((date, index) => {
    const weatherCode = valueAt(daily.weather_code as number[] | undefined, index);
    const condition = conditionFromWeather(weatherCode, null, true);

    return {
      date,
      conditionLabel: condition.label,
      conditionIcon: condition.icon,
      precipitationProbabilityMax: round(valueAt(daily.precipitation_probability_max as number[] | undefined, index)),
      precipitationSumInches: round(valueAt(daily.precipitation_sum as number[] | undefined, index), 2),
      temperatureMaxF: round(valueAt(daily.temperature_2m_max as number[] | undefined, index)),
      temperatureMinF: round(valueAt(daily.temperature_2m_min as number[] | undefined, index)),
      uvIndexMax: round(valueAt(daily.uv_index_max as number[] | undefined, index), 1),
      sunrise: valueAt(daily.sunrise as string[] | undefined, index),
      sunset: valueAt(daily.sunset as string[] | undefined, index),
      daylightDurationSeconds: round(valueAt(daily.daylight_duration as number[] | undefined, index)),
      sunshineDurationSeconds: round(valueAt(daily.sunshine_duration as number[] | undefined, index)),
    };
  });
};

export const normalizeOpenMeteo = (
  forecast: OpenMeteoForecast,
  location: LocationResult,
  selectedDate?: string,
): SunnyDaySummary => {
  const hourly = buildHourly(forecast);
  const daily = buildDaily(forecast);
  const timezone = location.timezone ?? forecast.timezone;
  const now = new Date();
  const selectedDateKey = selectedDate ?? dateKeyInTimeZone(now, timezone);
  const selectedDayHours = hourly.filter((hour) => hour.time.startsWith(selectedDateKey));
  const selectedDaily = daily.find((day) => day.date === selectedDateKey) ?? daily[0];
  const isSelectedToday = selectedDateKey === dateKeyInTimeZone(now, timezone);
  const currentHourKey = hourKeyInTimeZone(now, timezone);
  const current = isSelectedToday
    ? selectedDayHours.find((hour) => hour.time.slice(0, 13) >= currentHourKey) ?? selectedDayHours[0]
    : selectedDayHours.find((hour) => hour.isDay && Number(hour.time.slice(11, 13)) >= 9) ?? selectedDayHours[0] ?? hourly[0];

  if (!current) {
    throw new Error('Open-Meteo returned no hourly forecast data.');
  }

  const currentIndex = selectedDayHours.findIndex((hour) => hour.time === current.time);
  const globalCurrentIndex = hourly.findIndex((hour) => hour.time === current.time);
  const selectedHourly = isSelectedToday
    ? hourly.slice(Math.max(globalCurrentIndex, 0), Math.max(globalCurrentIndex, 0) + 48)
    : selectedDayHours.slice(Math.max(currentIndex, 0));
  const scoringHourly = selectedDayHours.slice(Math.max(currentIndex, 0));
  const scoringDaily = selectedDaily ? [selectedDaily, ...daily.filter((day) => day.date !== selectedDaily.date)] : daily;
  const score = scoreSunnyDay(scoringHourly, scoringDaily);
  const summaryText = buildSummaryText(score.label, current, scoringHourly, scoringDaily, timezone);
  const insights = buildInsights(
    score,
    score.score,
    score.label,
    current,
    scoringHourly,
    scoringDaily,
    selectedDateKey,
    timezone,
  );

  return {
    location: { ...location, timezone },
    selectedDate: selectedDateKey,
    current,
    hourly: selectedHourly,
    scoringHourly,
    daily,
    sunnyDayScore: score.score,
    scoreLabel: score.label,
    summaryText,
    aiInsight: insights.paragraph,
    reasons: score.reasons,
    insights,
    breakdown: score.breakdown,
    scene: deriveScene(current, selectedDaily, scoringDaily[0]?.temperatureMaxF ?? null),
    sources: {
      openMeteo: 'ok',
      models: 'loading',
      rainViewer: 'loading',
      nws: 'loading',
      airQuality: 'loading',
    },
    generatedAt: new Date().toISOString(),
  };
};

const isHeatAlert = (alert: NwsAlert) => /heat/i.test(alert.event);

/**
 * Single recompute path for the whole summary.
 *
 * Everything that can arrive late - model consensus, NWS alerts, air
 * quality - funnels through here, so the score, the label, the breakdown,
 * the prose, and the background scene are always derived from the same
 * inputs. Previously the alert path rebuilt some of these and left others
 * stale, which is how the headline could describe a day the score no longer
 * agreed with.
 */
export const rescoreSummary = (
  summary: SunnyDaySummary,
  nwsAlerts: NwsAlert[] = summary.nwsAlerts ?? [],
  airQuality: AirQualityData | undefined = summary.airQuality,
): SunnyDaySummary => {
  const selectedDaily = summary.daily.find((day) => day.date === summary.selectedDate) ?? summary.daily[0];
  const scoringDaily = selectedDaily
    ? [selectedDaily, ...summary.daily.filter((day) => day.date !== selectedDaily.date)]
    : summary.daily;

  const score = scoreSunnyDay(summary.scoringHourly, scoringDaily, nwsAlerts, airQuality);

  // The consensus base already contains each model's weather penalties.
  // Only air quality is an additive adjustment here. Alerts and current
  // weather are hard caps: subtracting the primary run's alert-driven drop
  // from the consensus and then applying the cap again double-counted the
  // same hazard and could turn a legitimate 25 into 0.
  const cleanScore = scoreSunnyDay(summary.scoringHourly, scoringDaily).score;
  const consensusBaseScore = summary.consensusBaseScore ?? cleanScore;
  const airOnlyScore = scoreSunnyDay(summary.scoringHourly, scoringDaily, [], airQuality).score;
  const airAdjustment = Math.max(0, cleanScore - airOnlyScore);
  const computedScore =
    summary.consensusBaseScore === undefined
      ? score.score
      : Math.round(
          applyAlertScoreCap(
            applyWeatherScoreCap(Math.max(0, consensusBaseScore - airAdjustment), summary.scoringHourly),
            nwsAlerts,
          ),
        );

  // Damp meaningless movement, but only once the models have actually been
  // compared. Stabilising the single-run score would pin the display to a
  // provisional number, and stabilising each model's own summary would have
  // every model collide on the same storage key.
  const finalScore =
    summary.consensusBaseScore !== undefined
      ? stabiliseScore(
          `${summary.location.latitude.toFixed(2)},${summary.location.longitude.toFixed(2)}`,
          summary.selectedDate,
          computedScore,
        )
      : computedScore;
  const finalLabel = labelForScore(finalScore);

  const insights = buildInsights(
    score,
    finalScore,
    finalLabel,
    summary.current,
    summary.scoringHourly,
    scoringDaily,
    summary.selectedDate,
    summary.location.timezone,
    nwsAlerts,
    airQuality,
  );

  const accuracyPhrase = summary.accuracy ? ` ${summary.accuracy.summary}` : '';

  return {
    ...summary,
    nwsAlerts,
    airQuality,
    sunnyDayScore: finalScore,
    scoreLabel: finalLabel,
    summaryText: buildSummaryText(
      finalLabel,
      summary.current,
      summary.scoringHourly,
      scoringDaily,
      summary.location.timezone,
    ),
    aiInsight: `${insights.paragraph}${accuracyPhrase}`,
    reasons: score.reasons,
    insights,
    breakdown: score.breakdown,
    scene: deriveScene(
      summary.current,
      selectedDaily,
      scoringDaily[0]?.temperatureMaxF ?? null,
      nwsAlerts.some(isHeatAlert),
    ),
  };
};

/** Backwards-compatible alias; alerts are just one input to the rescore. */
export const applyNwsAlerts = (summary: SunnyDaySummary, nwsAlerts: NwsAlert[]): SunnyDaySummary =>
  rescoreSummary(summary, nwsAlerts, summary.airQuality);

export const applyAirQuality = (summary: SunnyDaySummary, airQuality: AirQualityData): SunnyDaySummary =>
  rescoreSummary(summary, summary.nwsAlerts ?? [], airQuality);
