import type { DailySunnyData, HourlySunnyData, ScoreLabel } from '../../types/weather';
import { clamp } from './units';

type ScoreResult = {
  score: number;
  label: ScoreLabel;
  reasons: string[];
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

const labelForScore = (score: number): ScoreLabel => {
  if (score >= 90) return 'Great SunnyDay';
  if (score >= 75) return 'Pretty Good';
  if (score >= 55) return 'Mixed';
  if (score >= 35) return 'Risky';
  return 'Stay Inside';
};

export const scoreSunnyDay = (hourly: HourlySunnyData[], daily: DailySunnyData[]): ScoreResult => {
  const current = hourly[0];
  const daytime = hourly.filter((hour) => hour.isDay !== false).slice(0, 12);
  const window = daytime.length >= 4 ? daytime : hourly.slice(0, 12);
  const next6 = window.slice(0, 6);
  const today = daily[0];

  const rainRisk = max(window.map((hour) => hour.precipitationProbability)) ?? 0;
  const avgRainRisk = average(window.map((hour) => hour.precipitationProbability)) ?? 0;
  const measurableRain = window.reduce(
    (sum, hour) => sum + (hour.precipitationInches ?? 0) + (hour.rainInches ?? 0) + (hour.showersInches ?? 0),
    0,
  );
  const avgCloud = average(window.map((hour) => hour.cloudCover)) ?? 0;
  const lowCloud = average(window.map((hour) => hour.lowCloudCover)) ?? 0;
  const humidity = average(next6.map((hour) => hour.humidity)) ?? 0;
  const apparentTemperature = average(next6.map((hour) => hour.apparentTemperatureF ?? hour.temperatureF)) ?? 72;
  const gusts = max(next6.map((hour) => hour.windGustMph)) ?? 0;
  const uv = max(next6.map((hour) => hour.uvIndex)) ?? 0;
  const currentCode = current?.weatherCode ?? null;
  const wetCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
  const snowCodes = new Set([71, 73, 75, 77, 85, 86]);
  const currentWet = currentCode !== null && wetCodes.has(currentCode);
  const currentSnow = currentCode !== null && snowCodes.has(currentCode);
  const sunshineRatio =
    today?.sunshineDurationSeconds && today?.daylightDurationSeconds
      ? today.sunshineDurationSeconds / today.daylightDurationSeconds
      : null;

  let score = 100;
  const reasons: string[] = [];

  if (currentWet) {
    score -= 28;
    if ([95, 96, 99].includes(currentCode ?? -1)) score -= 10;
    reasons.push(`Current conditions still show rain or storms, so the score stays cautious.`);
  } else if (currentSnow) {
    score -= 34;
    reasons.push(`Current wintry precipitation is not an easy outside-day signal.`);
  }

  if (rainRisk >= 60) {
    score -= 35;
    reasons.push(`Rain is likely within the main outside window (${Math.round(rainRisk)}%).`);
  } else if (rainRisk >= 40) {
    score -= 25;
    reasons.push(`Showers are possible later (${Math.round(rainRisk)}% peak risk).`);
  } else if (rainRisk >= 20) {
    score -= 12;
    reasons.push(`Rain risk is present but manageable (${Math.round(rainRisk)}% peak).`);
  } else if (!currentWet && !currentSnow) {
    reasons.push(`Low precipitation risk through the next several daylight hours.`);
  }

  if (measurableRain >= 0.15) {
    score -= 18;
    reasons.push(`Forecast shows measurable rain accumulation.`);
  } else if (measurableRain > 0.02) {
    score -= 8;
    reasons.push(`Light rain or showers may add up a little.`);
  }

  if (avgCloud >= 80) {
    score -= 30;
    reasons.push(`Cloud cover is heavy around ${Math.round(avgCloud)}%.`);
  } else if (avgCloud >= 65) {
    score -= 26;
    reasons.push(`A gray-leaning sky with about ${Math.round(avgCloud)}% cloud cover.`);
  } else if (avgCloud >= 50) {
    score -= 18;
    reasons.push(`A mixed sky with about ${Math.round(avgCloud)}% cloud cover.`);
  } else if (avgCloud >= 35) {
    score -= 8;
    reasons.push(`Some clouds are present, but the sky still has room to open up.`);
  } else {
    reasons.push(`Cloud cover stays friendly for sunshine.`);
  }

  if (lowCloud >= 70) {
    score -= 6;
    reasons.push(`Low clouds may make the sky feel grayer than the headline forecast.`);
  }

  if (sunshineRatio !== null) {
    if (sunshineRatio >= 0.7 && avgRainRisk < 35 && !currentWet && !currentSnow) {
      score += 4;
      reasons.push(`Sunshine duration looks strong for the day.`);
    } else if (sunshineRatio < 0.35) {
      score -= 12;
      reasons.push(`Limited sunshine duration lowers the outside-day feel.`);
    }
  }

  if (humidity >= 85) {
    score -= 12;
    reasons.push(`Humidity is very high and may feel sticky.`);
  } else if (humidity >= 70) {
    score -= 6;
    reasons.push(`Humidity is elevated but not a deal-breaker.`);
  }

  if (apparentTemperature >= 95) {
    score -= 16;
    reasons.push(`The heat index is uncomfortable for long outside time.`);
  } else if (apparentTemperature >= 88 && humidity >= 65) {
    score -= 10;
    reasons.push(`Hot and humid air reduces comfort even if the sky improves.`);
  } else if (apparentTemperature >= 88 || apparentTemperature <= 35) {
    score -= 7;
    reasons.push(`Temperature comfort is outside the easy range.`);
  } else if (apparentTemperature >= 58 && apparentTemperature <= 82 && humidity < 70 && !currentWet) {
    reasons.push(`Temperature comfort is in the ideal outside range.`);
  }

  if (gusts >= 35) {
    score -= 12;
    reasons.push(`Wind gusts could be disruptive near ${Math.round(gusts)} mph.`);
  } else if (gusts >= 25) {
    score -= 6;
    reasons.push(`Breezy gusts are worth noticing.`);
  }

  if (uv >= 8) {
    score -= 5;
    reasons.push(`Very high UV means shade and sunscreen matter.`);
  } else if (uv >= 6) {
    score -= 2;
    reasons.push(`UV is high enough to plan sun protection.`);
  }

  const rounded = Math.round(clamp(score, 0, 100));

  return {
    score: rounded,
    label: labelForScore(rounded),
    reasons: reasons.slice(0, 5),
  };
};
