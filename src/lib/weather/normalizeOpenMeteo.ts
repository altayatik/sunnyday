import type { DailySunnyData, HourlySunnyData, LocationResult, SunnyDaySummary } from '../../types/weather';
import { conditionFromWeather } from './weatherCodes';
import { scoreSunnyDay } from './sunnyDayScore';
import { round } from './units';
import { buildAiInsight, buildSummaryText } from './summaries';
import { dateKeyInTimeZone } from '../date';

type OpenMeteoForecast = {
  latitude: number;
  longitude: number;
  timezone?: string;
  hourly?: Record<string, Array<number | string | null>>;
  daily?: Record<string, Array<number | string | null>>;
};

const valueAt = <T>(values: T[] | undefined, index: number): T | null => values?.[index] ?? null;

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
  const current = isSelectedToday
    ? selectedDayHours.find((hour) => new Date(hour.time).getTime() >= now.getTime() - 60 * 60 * 1000) ?? selectedDayHours[0]
    : selectedDayHours.find((hour) => hour.isDay && Number(hour.time.slice(11, 13)) >= 9) ?? selectedDayHours[0] ?? hourly[0];

  if (!current) {
    throw new Error('Open-Meteo returned no hourly forecast data.');
  }

  const currentIndex = selectedDayHours.findIndex((hour) => hour.time === current.time);
  const globalCurrentIndex = hourly.findIndex((hour) => hour.time === current.time);
  const selectedHourly = isSelectedToday
    ? hourly.slice(Math.max(globalCurrentIndex, 0), Math.max(globalCurrentIndex, 0) + 48)
    : selectedDayHours.slice(Math.max(currentIndex, 0));
  const scoringDaily = selectedDaily ? [selectedDaily, ...daily.filter((day) => day.date !== selectedDaily.date)] : daily;
  const score = scoreSunnyDay(selectedHourly, scoringDaily);
  const summaryText = buildSummaryText(score.label, current, selectedHourly, scoringDaily, timezone);

  return {
    location: { ...location, timezone },
    selectedDate: selectedDateKey,
    current,
    hourly: selectedHourly,
    daily,
    sunnyDayScore: score.score,
    scoreLabel: score.label,
    summaryText,
    aiInsight: buildAiInsight(score.label, score.score, current, selectedHourly, scoringDaily, score.reasons, timezone),
    reasons: score.reasons,
    sources: {
      openMeteo: 'ok',
      rainViewer: 'loading',
      nws: 'loading',
    },
    generatedAt: new Date().toISOString(),
  };
};
