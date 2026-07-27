import type { DailySunnyData, HourlySunnyData, NwsAlert, ScoreLabel } from '../../types/weather';
import { clamp } from './units';

export type ScoreResult = {
  score: number;
  label: ScoreLabel;
  reasons: string[];
  breakdown: {
    sky: number;
    precipitation: number;
    comfort: number;
    safety: number;
  };
};

const average = (values: Array<number | null | undefined>) => {
  const present = values.filter((value): value is number => value !== null && value !== undefined);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
};

const max = (values: Array<number | null | undefined>) => {
  const present = values.filter((value): value is number => value !== null && value !== undefined);
  if (present.length === 0) return null;
  return Math.max(...present);
};

export const labelForScore = (score: number): ScoreLabel => {
  if (score >= 90) return 'Great SunnyDay';
  if (score >= 75) return 'Pretty Good';
  if (score >= 55) return 'Mixed';
  if (score >= 35) return 'Risky';
  return 'Stay Inside';
};

const wetCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const stormCodes = new Set([95, 96, 99]);
const snowCodes = new Set([71, 73, 75, 77, 85, 86]);

export const alertPriority = (alert: NwsAlert) => {
  const event = alert.event.toLowerCase();
  if (event.includes('tornado warning')) return 100;
  if (event.includes('severe thunderstorm warning')) return 90;
  if (event.includes('flash flood warning')) return 80;
  if (event.includes('extreme heat warning')) return 70;
  if (event.includes('heat advisory')) return 60;
  if (event.includes('warning')) return 50;
  return 10;
};

export const applyAlertScoreCap = (score: number, alerts: NwsAlert[]) => {
  const priority = alerts.reduce((highest, alert) => Math.max(highest, alertPriority(alert)), 0);
  if (priority >= 100) return Math.min(score, 8);
  if (priority >= 90) return Math.min(score, 20);
  if (priority >= 80) return Math.min(score, 25);
  if (priority >= 70) return Math.min(score, 45);
  return score;
};

/**
 * Bounded category model shared with SunnyDay iOS.
 *
 * The old scorer stacked every penalty against one 100-point bucket, could
 * score tomorrow against tonight, and counted precipitation more than once.
 * Here each category is independently clamped before weighting, so clouds,
 * humidity, wind, and a rain chance can explain a mixed day without combining
 * into a misleading single-digit emergency score.
 */
export const scoreSunnyDay = (
  hourly: HourlySunnyData[],
  daily: DailySunnyData[],
  alerts: NwsAlert[] = [],
): ScoreResult => {
  const current = hourly[0];
  const daytime = hourly.filter((hour) => hour.isDay !== false).slice(0, 12);
  const window = daytime.length >= 4 ? daytime : hourly.slice(0, 12);
  const next6 = window.slice(0, 6);
  const selectedDay = daily[0];

  const peakRain = max(window.map((hour) => hour.precipitationProbability)) ?? 0;
  const precipitationAmount = window.reduce((sum, hour) => sum + (hour.precipitationInches ?? 0), 0);
  const averageCloud = average(window.map((hour) => hour.cloudCover)) ?? current?.cloudCover ?? 0;
  const lowCloud = average(window.map((hour) => hour.lowCloudCover)) ?? 0;
  const humidity = average(next6.map((hour) => hour.humidity)) ?? current?.humidity ?? 50;
  const apparentTemperature = average(next6.map((hour) => hour.apparentTemperatureF ?? hour.temperatureF)) ?? 72;
  const gusts = max(next6.map((hour) => hour.windGustMph)) ?? 0;
  const uv = max(next6.map((hour) => hour.uvIndex)) ?? 0;
  const currentCode = current?.weatherCode ?? null;
  const currentWet = currentCode !== null && wetCodes.has(currentCode);
  const currentStorm = currentCode !== null && stormCodes.has(currentCode);
  const currentSnow = currentCode !== null && snowCodes.has(currentCode);
  const currentPrecipitation = current?.precipitationInches ?? 0;
  const currentHeavyPrecipitation = currentWet && currentPrecipitation >= 0.1;
  const reasons: string[] = [];

  let precipitation = 100;
  if (currentStorm) {
    precipitation = 30;
    reasons.push('Thunderstorms are active now, so outdoor confidence is low.');
  } else if (currentSnow) {
    precipitation = 45;
    reasons.push('Wintry precipitation is active now.');
  } else if (currentWet) {
    precipitation = 50;
    reasons.push('Wet weather is active now.');
  } else if (peakRain >= 80) {
    precipitation = 45;
    reasons.push(`Rain risk is very high in the selected-day window (${Math.round(peakRain)}%).`);
  } else if (peakRain >= 60) {
    precipitation = 60;
    reasons.push(`Rain is likely in the selected-day window (${Math.round(peakRain)}%).`);
  } else if (peakRain >= 40) {
    precipitation = 75;
    reasons.push(`Showers are possible in the selected-day window (${Math.round(peakRain)}% peak).`);
  } else if (peakRain >= 20) {
    precipitation = 88;
    reasons.push(`Rain risk is present but manageable (${Math.round(peakRain)}% peak).`);
  } else {
    reasons.push('Precipitation risk is low in the selected-day window.');
  }

  if (precipitationAmount >= 0.5) precipitation -= 20;
  else if (precipitationAmount >= 0.15) precipitation -= 12;
  else if (precipitationAmount > 0.02) precipitation -= 5;
  precipitation = clamp(precipitation, 0, 100);

  let sky = 100;
  if (averageCloud >= 80) sky = 50;
  else if (averageCloud >= 65) sky = 65;
  else if (averageCloud >= 50) sky = 78;
  else if (averageCloud >= 35) sky = 90;

  if (averageCloud >= 65) {
    reasons.push(`Cloud cover is fairly high around ${Math.round(averageCloud)}%.`);
  } else if (averageCloud >= 35) {
    reasons.push(`Some clouds are present around ${Math.round(averageCloud)}%.`);
  } else {
    reasons.push('Cloud cover remains friendly for open-sky conditions.');
  }
  if (lowCloud >= 70) sky -= 5;

  const sunshineRatio =
    selectedDay?.sunshineDurationSeconds && selectedDay.daylightDurationSeconds
      ? selectedDay.sunshineDurationSeconds / selectedDay.daylightDurationSeconds
      : null;
  if (sunshineRatio !== null && sunshineRatio < 0.35) sky -= 8;
  else if (sunshineRatio !== null && sunshineRatio >= 0.7 && !currentWet) sky += 3;
  sky = clamp(sky, 0, 100);

  let comfort = 100;
  if (humidity >= 85) {
    comfort -= 12;
    reasons.push('Humidity is very high and may feel sticky.');
  } else if (humidity >= 70) {
    comfort -= 6;
    reasons.push('Humidity is elevated but not a deal-breaker.');
  }

  if (apparentTemperature >= 105) comfort -= 25;
  else if (apparentTemperature >= 95) comfort -= 15;
  else if (apparentTemperature >= 88) comfort -= 8;
  else if (apparentTemperature <= 35) comfort -= 10;

  if (gusts >= 35) comfort -= 12;
  else if (gusts >= 25) comfort -= 6;
  if (uv >= 8) comfort -= 5;
  else if (uv >= 6) comfort -= 2;
  comfort = clamp(comfort, 0, 100);

  let safety = currentStorm ? 20 : currentSnow ? 60 : currentHeavyPrecipitation ? 55 : currentWet ? 70 : 100;
  const primaryAlert = [...alerts].sort((a, b) => alertPriority(b) - alertPriority(a))[0];
  const priority = primaryAlert ? alertPriority(primaryAlert) : 0;
  let alertAdjustedSafety = safety;
  if (priority >= 100) alertAdjustedSafety = 0;
  else if (priority >= 90) alertAdjustedSafety = Math.min(alertAdjustedSafety, 10);
  else if (priority >= 80) alertAdjustedSafety = Math.min(alertAdjustedSafety, 20);
  else if (priority >= 70) alertAdjustedSafety = Math.min(alertAdjustedSafety, 45);
  else if (priority >= 60) alertAdjustedSafety = Math.min(alertAdjustedSafety, 70);
  else if (priority >= 50) alertAdjustedSafety = Math.min(alertAdjustedSafety, 75);

  if (primaryAlert && priority >= 50) {
    reasons.unshift(`${primaryAlert.event} is active and is the main safety constraint.`);
  }

  let score = sky * 0.25 + precipitation * 0.35 + comfort * 0.25 + alertAdjustedSafety * 0.15;
  if (priority >= 100) score = Math.min(score, 8);
  else if (priority >= 90) score = Math.min(score, 20);
  else if (priority >= 80) score = Math.min(score, 25);
  else if (priority >= 70) score = Math.min(score, 45);
  else if (currentStorm) score = Math.min(score, 25);
  else if (currentHeavyPrecipitation) score = Math.min(score, 40);
  else if (currentSnow) score = Math.min(score, 60);
  else if (currentWet) score = Math.min(score, 55);
  else if (peakRain >= 80) score = Math.min(score, 58);
  else if (peakRain >= 60) score = Math.min(score, 72);

  const rounded = Math.round(clamp(score, 0, 100));
  return {
    score: rounded,
    label: labelForScore(rounded),
    reasons: reasons.slice(0, 5),
    breakdown: {
      sky: Math.round(sky),
      precipitation: Math.round(precipitation),
      comfort: Math.round(comfort),
      safety: Math.round(alertAdjustedSafety),
    },
  };
};
