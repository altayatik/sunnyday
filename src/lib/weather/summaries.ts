import type { DailySunnyData, HourlySunnyData, ScoreLabel } from '../../types/weather';
import { formatHour } from '../date';

const wetCode = (weatherCode: number | null) =>
  weatherCode !== null && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode);

const wetLabel = (label: string) => /thunder|rain|shower|drizzle/i.test(label);

export const hasWetSignal = (hour: HourlySunnyData) =>
  wetCode(hour.weatherCode) || wetLabel(hour.conditionLabel) || (hour.precipitationProbability ?? 0) >= 45;

const findRainWindow = (hourly: HourlySunnyData[], threshold = 45) =>
  hourly.find((hour) => hasWetSignal(hour) || (hour.precipitationProbability ?? 0) >= threshold);

export const buildSummaryText = (
  label: ScoreLabel,
  current: HourlySunnyData,
  hourly: HourlySunnyData[],
  daily: DailySunnyData[],
  timeZone?: string,
) => {
  const rainWindow = findRainWindow(hourly.slice(0, 24));
  const cloud = current.cloudCover !== null ? `${Math.round(current.cloudCover)}% cloud cover` : 'clouds uncertain';
  const activeWet = /thunder|rain|shower|drizzle|snow/i.test(current.conditionLabel);
  const today = daily[0];
  const sunshine =
    today?.sunshineDurationSeconds && today.daylightDurationSeconds
      ? Math.round((today.sunshineDurationSeconds / today.daylightDurationSeconds) * 100)
      : null;

  if (activeWet) {
    return `${label}: ${current.conditionLabel.toLowerCase()} now with ${cloud}. Conditions may still vary even if model rain probability is low.`;
  }

  if (rainWindow) {
    return `${label}: ${current.conditionLabel.toLowerCase()} now with ${cloud}. Rain risk rises around ${formatHour(
      rainWindow.time,
      timeZone,
    )}.`;
  }

  if (current.isDay && sunshine !== null && sunshine >= 65) {
    return `${label}: ${current.conditionLabel.toLowerCase()} with generous sunshine and no major rain signal nearby.`;
  }

  return `${label}: ${current.conditionLabel.toLowerCase()} with ${cloud} and no strong precipitation signal in the next day.`;
};

export const precipitationLabel = (probability: number | null, inchesValue: number | null) => {
  const probabilityValue = probability ?? 0;
  const amount = inchesValue ?? 0;

  if (amount >= 0.4 || probabilityValue >= 80) return 'Heavy rain risk';
  if (probabilityValue >= 60 || amount >= 0.1) return 'Rain likely';
  if (probabilityValue >= 25 || amount > 0) return 'Possible showers';
  return 'Dry';
};

export const sunshineQuality = (daily: DailySunnyData | undefined, currentCloudCover: number | null) => {
  if (!daily?.sunshineDurationSeconds || !daily.daylightDurationSeconds) {
    if ((currentCloudCover ?? 100) < 35) return 'Bright';
    if ((currentCloudCover ?? 100) < 70) return 'Filtered';
    return 'Muted';
  }

  const ratio = daily.sunshineDurationSeconds / daily.daylightDurationSeconds;
  if (ratio >= 0.7) return 'Excellent';
  if (ratio >= 0.5) return 'Good';
  if (ratio >= 0.32) return 'Filtered';
  return 'Muted';
};

export const comfortNotes = (current: HourlySunnyData) => {
  const notes: string[] = [];

  if ((current.humidity ?? 0) >= 85) notes.push('Very humid');
  else if ((current.humidity ?? 0) >= 70) notes.push('Humid');
  else if ((current.humidity ?? 100) <= 35) notes.push('Dry');
  else notes.push('Comfortable humidity');

  if ((current.windGustMph ?? 0) >= 30) notes.push('Gusty');
  else if ((current.windSpeedMph ?? 0) >= 15) notes.push('Breezy');
  else notes.push('Light wind');

  if ((current.uvIndex ?? 0) >= 8) notes.push('Very high UV');
  else if ((current.uvIndex ?? 0) >= 6) notes.push('High UV');
  else if ((current.uvIndex ?? 0) > 0) notes.push('UV manageable');

  return notes;
};
