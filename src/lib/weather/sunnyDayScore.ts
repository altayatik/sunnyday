import type {
  AirQualityData,
  DailySunnyData,
  HourlySunnyData,
  InsightFactor,
  NwsAlert,
  ScoreBreakdown,
  ScoreLabel,
} from '../../types/weather';
import { clamp } from './units';

export type ScoreResult = {
  score: number;
  label: ScoreLabel;
  reasons: string[];
  /** Structured factors, shared with the insights engine and SunnyDay iOS. */
  positives: InsightFactor[];
  negatives: InsightFactor[];
  recommendations: string[];
  breakdown: ScoreBreakdown;
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
 * Category weights. Precipitation dominates because rain is the single
 * factor most likely to cancel an outdoor plan; air quality is deliberately
 * the smallest term, since it modifies a good day rather than defining it -
 * but it can still cost ten points, which is the difference between
 * "Great SunnyDay" and "Pretty Good".
 */
const weights = {
  sky: 0.22,
  precipitation: 0.32,
  comfort: 0.22,
  safety: 0.14,
  air: 0.1,
} as const;

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
  airQuality?: AirQualityData,
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
  const positives: InsightFactor[] = [];
  const negatives: InsightFactor[] = [];
  const recommendations: string[] = [];

  const record = (factor: Omit<InsightFactor, 'id'> & { positive?: boolean }) => {
    const { positive = false, ...rest } = factor;
    const entry: InsightFactor = { ...rest, id: `${rest.title}-${rest.tone}` };
    reasons.push(entry.detail);
    if (positive) positives.push(entry);
    else negatives.push(entry);
  };

  let precipitation = 100;
  if (currentStorm) {
    precipitation = 30;
    record({
      title: 'Thunderstorms now',
      detail: 'Thunderstorms are active now, so outdoor confidence is low.',
      icon: 'cloud-lightning',
      tone: 'alert',
      points: 70,
    });
    recommendations.push('Wait for the thunderstorms to clear before heading outside.');
  } else if (currentSnow) {
    precipitation = 45;
    record({
      title: 'Wintry precipitation',
      detail: 'Wintry precipitation is active now.',
      icon: 'cloud-snow',
      tone: 'rain',
      points: 55,
    });
    recommendations.push('Allow extra travel time and dress for wet, cold footing.');
  } else if (currentWet) {
    precipitation = 50;
    record({
      title: 'Wet weather now',
      detail: 'Wet weather is active now.',
      icon: 'cloud-rain',
      tone: 'rain',
      points: 50,
    });
    recommendations.push('Take a rain layer, or wait for the current band to move through.');
  } else if (peakRain >= 80) {
    precipitation = 45;
    record({
      title: 'Very high rain risk',
      detail: `Rain risk is very high in the selected-day window (${Math.round(peakRain)}%).`,
      icon: 'umbrella',
      tone: 'rain',
      points: 55,
    });
    recommendations.push('Plan around cover; a dry stretch is unlikely to hold.');
  } else if (peakRain >= 60) {
    precipitation = 60;
    record({
      title: 'Rain likely',
      detail: `Rain is likely in the selected-day window (${Math.round(peakRain)}%).`,
      icon: 'umbrella',
      tone: 'rain',
      points: 40,
    });
    recommendations.push('Carry a rain layer and keep plans flexible.');
  } else if (peakRain >= 40) {
    precipitation = 75;
    record({
      title: 'Showers possible',
      detail: `Showers are possible in the selected-day window (${Math.round(peakRain)}% peak).`,
      icon: 'cloud-rain',
      tone: 'rain',
      points: 25,
    });
  } else if (peakRain >= 20) {
    precipitation = 88;
    record({
      title: 'Manageable rain risk',
      detail: `Rain risk is present but manageable (${Math.round(peakRain)}% peak).`,
      icon: 'cloud-sun',
      tone: 'rain',
      points: 12,
    });
  } else {
    record({
      title: 'Low precipitation risk',
      detail: 'Precipitation risk is low in the selected-day window.',
      icon: 'sun',
      tone: 'sun',
      points: 0,
      positive: true,
    });
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
    record({
      title: 'Heavy cloud cover',
      detail: `Cloud cover is fairly high around ${Math.round(averageCloud)}%.`,
      icon: 'cloud',
      tone: 'cloud',
      points: averageCloud >= 80 ? 50 : 35,
    });
  } else if (averageCloud >= 35) {
    record({
      title: 'Some clouds',
      detail: `Some clouds are present around ${Math.round(averageCloud)}%.`,
      icon: 'cloud-sun',
      tone: 'cloud',
      points: 15,
    });
  } else {
    record({
      title: 'Open sky',
      detail: 'Cloud cover remains friendly for open-sky conditions.',
      icon: 'sun',
      tone: 'sun',
      points: 0,
      positive: true,
    });
  }
  if (lowCloud >= 70) sky -= 5;

  const sunshineRatio =
    selectedDay?.sunshineDurationSeconds && selectedDay.daylightDurationSeconds
      ? selectedDay.sunshineDurationSeconds / selectedDay.daylightDurationSeconds
      : null;
  if (sunshineRatio !== null && sunshineRatio < 0.35) sky -= 8;
  else if (sunshineRatio !== null && sunshineRatio >= 0.7 && !currentWet) {
    sky += 3;
    record({
      title: 'Strong sunshine',
      detail: `Sunshine covers about ${Math.round(sunshineRatio * 100)}% of the daylight hours.`,
      icon: 'sun',
      tone: 'sun',
      points: 0,
      positive: true,
    });
  }
  sky = clamp(sky, 0, 100);

  let comfort = 100;
  if (humidity >= 85) {
    comfort -= 12;
    record({
      title: 'Very humid',
      detail: 'Humidity is very high and may feel sticky.',
      icon: 'droplets',
      tone: 'comfort',
      points: 12,
    });
  } else if (humidity >= 70) {
    comfort -= 6;
    record({
      title: 'Humid',
      detail: 'Humidity is elevated but not a deal-breaker.',
      icon: 'droplets',
      tone: 'comfort',
      points: 6,
    });
  }

  if (apparentTemperature >= 105) {
    comfort -= 25;
    record({
      title: 'Dangerous heat',
      detail: `It feels near ${Math.round(apparentTemperature)}°, which is hazardous for sustained activity.`,
      icon: 'thermometer-sun',
      tone: 'comfort',
      points: 25,
    });
    recommendations.push('Limit outdoor time to early morning or after sunset, and hydrate steadily.');
  } else if (apparentTemperature >= 95) {
    comfort -= 15;
    record({
      title: 'Hot',
      detail: `It feels near ${Math.round(apparentTemperature)}°, so comfort is capped.`,
      icon: 'thermometer-sun',
      tone: 'comfort',
      points: 15,
    });
    recommendations.push('Favour shade and take hydration breaks.');
  } else if (apparentTemperature >= 88) {
    comfort -= 8;
    record({
      title: 'Warm',
      detail: `It feels near ${Math.round(apparentTemperature)}°.`,
      icon: 'thermometer-sun',
      tone: 'comfort',
      points: 8,
    });
  } else if (apparentTemperature <= 35) {
    comfort -= 10;
    record({
      title: 'Cold',
      detail: `It feels near ${Math.round(apparentTemperature)}°, so layers matter.`,
      icon: 'thermometer-snowflake',
      tone: 'comfort',
      points: 10,
    });
    recommendations.push('Dress in layers and cover exposed skin.');
  } else if (apparentTemperature >= 60 && apparentTemperature <= 80) {
    record({
      title: 'Comfortable air',
      detail: `It feels near ${Math.round(apparentTemperature)}°, which is close to ideal.`,
      icon: 'thermometer-sun',
      tone: 'comfort',
      points: 0,
      positive: true,
    });
  }

  if (gusts >= 35) {
    comfort -= 12;
    record({
      title: 'Strong gusts',
      detail: `Gusts reach about ${Math.round(gusts)} mph.`,
      icon: 'wind',
      tone: 'wind',
      points: 12,
    });
    recommendations.push('Secure loose items; umbrellas will struggle in these gusts.');
  } else if (gusts >= 25) {
    comfort -= 6;
    record({
      title: 'Breezy',
      detail: `Gusts reach about ${Math.round(gusts)} mph.`,
      icon: 'wind',
      tone: 'wind',
      points: 6,
    });
  }

  if (uv >= 8) {
    comfort -= 5;
    record({
      title: 'Very high UV',
      detail: `UV peaks near ${Math.round(uv)}, so unprotected skin burns quickly.`,
      icon: 'sun-medium',
      tone: 'uv',
      points: 5,
    });
    recommendations.push('Use sunscreen and reapply; seek shade around midday.');
  } else if (uv >= 6) {
    comfort -= 2;
    record({
      title: 'High UV',
      detail: `UV peaks near ${Math.round(uv)}.`,
      icon: 'sun-medium',
      tone: 'uv',
      points: 2,
    });
    recommendations.push('Sunscreen is worth it today.');
  }
  comfort = clamp(comfort, 0, 100);

  // Air quality. Absent data scores a neutral 100 rather than penalising a
  // location simply because the provider has no coverage there.
  let air = 100;
  if (airQuality) {
    const aqi = airQuality.peakAqi ?? airQuality.usAqi;
    if (aqi !== null) {
      if (aqi > 200) {
        air = 10;
        record({
          title: 'Very unhealthy air',
          detail: `Air quality index peaks near ${Math.round(aqi)}, which is unsafe for outdoor exertion.`,
          icon: 'wind',
          tone: 'air',
          points: 90,
        });
        recommendations.push('Keep outdoor exertion short and consider staying indoors.');
      } else if (aqi > 150) {
        air = 32;
        record({
          title: 'Unhealthy air',
          detail: `Air quality index peaks near ${Math.round(aqi)}${
            airQuality.dominantPollutant ? `, led by ${airQuality.dominantPollutant}` : ''
          }.`,
          icon: 'wind',
          tone: 'air',
          points: 68,
        });
        recommendations.push('Reduce strenuous outdoor activity; sensitive groups should stay in.');
      } else if (aqi > 100) {
        air = 58;
        record({
          title: 'Poor air for sensitive groups',
          detail: `Air quality index peaks near ${Math.round(aqi)}${
            airQuality.dominantPollutant ? `, led by ${airQuality.dominantPollutant}` : ''
          }.`,
          icon: 'wind',
          tone: 'air',
          points: 42,
        });
        recommendations.push('If you are asthmatic or sensitive, keep intense activity short.');
      } else if (aqi > 50) {
        air = 84;
        record({
          title: 'Moderate air quality',
          detail: `Air quality index is around ${Math.round(aqi)} - acceptable for most people.`,
          icon: 'wind',
          tone: 'air',
          points: 16,
        });
      } else {
        record({
          title: 'Clean air',
          detail: `Air quality index is around ${Math.round(aqi)}.`,
          icon: 'wind',
          tone: 'air',
          points: 0,
          positive: true,
        });
      }
    }

    const peakPollen = airQuality.peakPollen;
    if (peakPollen && peakPollen.level >= 3) {
      air -= peakPollen.level >= 4 ? 14 : 8;
      record({
        title: `${peakPollen.levelLabel} ${peakPollen.label.toLowerCase()} pollen`,
        detail: `${peakPollen.label} pollen peaks near ${peakPollen.grainsPerM3} grains/m³ today.`,
        icon: 'flower',
        tone: 'air',
        points: peakPollen.level >= 4 ? 14 : 8,
      });
      recommendations.push('Allergy sufferers should medicate ahead of time and rinse off afterwards.');
    }
  }
  air = clamp(air, 0, 100);

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
    const detail = `${primaryAlert.event} is active and is the main safety constraint.`;
    reasons.unshift(detail);
    negatives.unshift({
      id: `alert-${primaryAlert.id}`,
      title: primaryAlert.event,
      detail,
      icon: 'alert-triangle',
      tone: 'alert',
      points: 100 - alertAdjustedSafety,
    });
    recommendations.unshift('Check the official alert text before committing to outdoor plans.');
  }

  let score =
    sky * weights.sky +
    precipitation * weights.precipitation +
    comfort * weights.comfort +
    alertAdjustedSafety * weights.safety +
    air * weights.air;

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

  // Air quality can cap an otherwise pristine day. Nothing is a "Great
  // SunnyDay" when the air is unhealthy to breathe.
  const peakAqi = airQuality?.peakAqi ?? airQuality?.usAqi ?? null;
  if (peakAqi !== null) {
    if (peakAqi > 200) score = Math.min(score, 30);
    else if (peakAqi > 150) score = Math.min(score, 52);
    else if (peakAqi > 100) score = Math.min(score, 74);
  }

  const rounded = Math.round(clamp(score, 0, 100));

  // Order negatives by what actually cost the most, so the UI leads with the
  // real reason rather than whichever check happened to run first.
  negatives.sort((a, b) => b.points - a.points);

  return {
    score: rounded,
    label: labelForScore(rounded),
    reasons: reasons.slice(0, 5),
    positives,
    negatives,
    recommendations: [...new Set(recommendations)].slice(0, 4),
    breakdown: {
      sky: Math.round(sky),
      precipitation: Math.round(precipitation),
      comfort: Math.round(comfort),
      safety: Math.round(alertAdjustedSafety),
      air: Math.round(air),
    },
  };
};
