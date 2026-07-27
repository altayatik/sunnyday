import type {
  AirQualityData,
  DailySunnyData,
  HourlySunnyData,
  InsightBundle,
  NwsAlert,
  OutdoorWindow,
  ScoreLabel,
} from '../../types/weather';
import { formatHour, formatShortDay } from '../date';
import type { ScoreResult } from './sunnyDayScore';
import { hasWetSignal } from './summaries';
import { clamp } from './units';

/**
 * Scores a single hour for "would I want to be outside right now".
 *
 * This is intentionally a simpler model than the full day score: it only
 * uses fields that vary hour to hour, so the resulting curve is smooth
 * enough to pick a real window out of rather than a jagged one.
 */
const hourScore = (hour: HourlySunnyData) => {
  let value = 100;

  const rain = hour.precipitationProbability ?? 0;
  if (rain >= 70) value -= 55;
  else if (rain >= 50) value -= 38;
  else if (rain >= 30) value -= 22;
  else if (rain >= 15) value -= 8;

  if ((hour.precipitationInches ?? 0) >= 0.05) value -= 20;

  const cloud = hour.cloudCover ?? 0;
  if (cloud >= 85) value -= 20;
  else if (cloud >= 65) value -= 12;
  else if (cloud >= 40) value -= 5;

  const feels = hour.apparentTemperatureF ?? hour.temperatureF;
  if (feels !== null) {
    if (feels >= 100) value -= 30;
    else if (feels >= 92) value -= 18;
    else if (feels >= 85) value -= 8;
    else if (feels <= 25) value -= 24;
    else if (feels <= 38) value -= 12;
  }

  const gust = hour.windGustMph ?? 0;
  if (gust >= 35) value -= 16;
  else if (gust >= 25) value -= 8;

  const uv = hour.uvIndex ?? 0;
  if (uv >= 9) value -= 8;
  else if (uv >= 7) value -= 4;

  if (hasWetSignal(hour)) value -= 15;
  if (hour.isDay === false) value -= 6;

  return clamp(value, 0, 100);
};

const windowLabel = (score: number) => {
  if (score >= 85) return 'Excellent window';
  if (score >= 72) return 'Good window';
  if (score >= 58) return 'Workable window';
  return 'Best of a rough day';
};

/**
 * Finds the best contiguous run of daylight hours. Prefers longer windows
 * when the quality is close, because a three-hour decent stretch is more
 * useful than a one-hour perfect one.
 */
export const findBestWindow = (hourly: HourlySunnyData[], timeZone?: string): OutdoorWindow | null => {
  const candidates = hourly.filter((hour) => hour.isDay !== false).slice(0, 18);
  if (candidates.length < 2) return null;

  const scores = candidates.map(hourScore);
  let best: { start: number; length: number; score: number } | null = null;

  for (let length = Math.min(4, candidates.length); length >= 2; length -= 1) {
    for (let start = 0; start + length <= candidates.length; start += 1) {
      const slice = scores.slice(start, start + length);
      const mean = slice.reduce((sum, value) => sum + value, 0) / slice.length;
      // Small bonus per extra hour so ties resolve toward longer windows.
      const adjusted = mean + (length - 2) * 1.5;
      if (!best || adjusted > best.score) best = { start, length, score: mean };
    }
  }

  if (!best) return null;

  const startHour = candidates[best.start];
  const endHour = candidates[best.start + best.length - 1];
  const score = Math.round(best.score);

  const peakRain = Math.max(
    ...candidates.slice(best.start, best.start + best.length).map((hour) => hour.precipitationProbability ?? 0),
  );
  const meanCloud = Math.round(
    candidates
      .slice(best.start, best.start + best.length)
      .reduce((sum, hour) => sum + (hour.cloudCover ?? 0), 0) / best.length,
  );

  return {
    startTime: startHour.time,
    endTime: endHour.time,
    hours: best.length,
    score,
    label: windowLabel(score),
    detail: `${formatHour(startHour.time, timeZone)} to ${formatHour(endHour.time, timeZone)} looks best - about ${meanCloud}% cloud and a ${Math.round(
      peakRain,
    )}% peak rain chance.`,
  };
};

/**
 * Looks ahead for a materially better day. Only surfaced when today is
 * genuinely mediocre, so it reads as helpful rather than as the app
 * constantly telling you to wait.
 */
const findBetterDay = (
  daily: DailySunnyData[],
  selectedDate: string,
  currentScore: number,
  timeZone?: string,
): InsightBundle['betterDay'] => {
  if (currentScore >= 70) return null;

  const upcoming = daily.filter((day) => day.date > selectedDate).slice(0, 5);

  // A light proxy score from daily aggregates; the full scorer needs hourly
  // data we do not want to refetch for every future day.
  const proxy = upcoming.map((day) => {
    let value = 100;
    const rain = day.precipitationProbabilityMax ?? 0;
    if (rain >= 70) value -= 45;
    else if (rain >= 50) value -= 30;
    else if (rain >= 30) value -= 16;
    else if (rain >= 15) value -= 6;
    if ((day.precipitationSumInches ?? 0) >= 0.25) value -= 15;

    const ratio =
      day.sunshineDurationSeconds && day.daylightDurationSeconds
        ? day.sunshineDurationSeconds / day.daylightDurationSeconds
        : null;
    if (ratio !== null) {
      if (ratio >= 0.7) value += 4;
      else if (ratio < 0.35) value -= 14;
      else if (ratio < 0.5) value -= 7;
    }

    const high = day.temperatureMaxF ?? 72;
    if (high >= 100) value -= 22;
    else if (high >= 92) value -= 10;
    else if (high <= 32) value -= 18;

    if ((day.uvIndexMax ?? 0) >= 9) value -= 5;

    return { date: day.date, score: Math.round(clamp(value, 0, 100)) };
  });

  const best = proxy.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < currentScore + 12) return null;

  return { date: best.date, score: best.score, label: formatShortDay(best.date, timeZone) };
};

/**
 * Builds the SunnyDay insight bundle.
 *
 * This is deliberately deterministic and rule-based rather than a model
 * call: it renders instantly, works offline, never contradicts the metric
 * tiles sitting next to it, and needs no API key - which matters because the
 * app ships as a static bundle with no backend. If a hosted model is added
 * later, replacing the body of this one function is the entire integration.
 */
export const buildInsights = (
  score: ScoreResult,
  finalScore: number,
  label: ScoreLabel,
  current: HourlySunnyData,
  hourly: HourlySunnyData[],
  daily: DailySunnyData[],
  selectedDate: string,
  timeZone?: string,
  alerts: NwsAlert[] = [],
  airQuality?: AirQualityData,
): InsightBundle => {
  const today = daily[0];
  const bestWindow = findBestWindow(hourly, timeZone);
  const betterDay = findBetterDay(daily, selectedDate, finalScore, timeZone);
  const primaryAlert = alerts[0];
  const feelsLike = current.apparentTemperatureF ?? current.temperatureF;
  const conditionLabel = current.conditionLabel;
  const nearTermRain = Math.round(current.precipitationProbability ?? today?.precipitationProbabilityMax ?? 0);
  const uv = Math.round(today?.uvIndexMax ?? current.uvIndex ?? 0);
  const activeWet = hasWetSignal(current);
  const storm = [95, 96, 99].includes(current.weatherCode ?? -1);

  // Headline: name the single dominant reason, in priority order, so the
  // sentence never buries a safety issue behind a note about clouds.
  let headline: string;
  if (primaryAlert) {
    headline = `${primaryAlert.event} is active and is the main safety concern right now. ${conditionLabel} skies do not change that - check the official alert before committing to outdoor plans.`;
  } else if (storm) {
    headline = 'Thunderstorms are moving through right now, so outdoor plans should wait for them to clear.';
  } else if (activeWet) {
    headline = `${conditionLabel} now with about a ${nearTermRain}% chance of rain through the next few hours. Keep plans flexible or favour a covered space until it passes.`;
  } else if ((airQuality?.peakAqi ?? 0) > 150) {
    headline = `${conditionLabel} and dry, but the air quality index peaks near ${Math.round(
      airQuality?.peakAqi ?? 0,
    )}. The sky looks better than the air does - keep exertion light.`;
  } else if ((feelsLike ?? 0) >= 96) {
    headline = `${conditionLabel} and dry now, but it feels like ${Math.round(
      feelsLike ?? 0,
    )}°. Outdoor time is best kept to shade, hydration breaks, or earlier and later in the day.`;
  } else if (uv >= 8) {
    headline = `${conditionLabel} and dry, with UV near ${uv}. Sun protection matters more than the temperature alone suggests.`;
  } else if (finalScore >= 80) {
    headline = `${conditionLabel} with low rain risk and comfortable air - one of the better windows for outdoor plans right now.`;
  } else {
    headline = `${conditionLabel} now. ${score.reasons[0] ?? 'The model signal is fairly balanced.'}`;
  }

  // Paragraph: the connected read - score, drivers, rain timing, sunshine,
  // then the best window.
  const rainHour = hourly.slice(0, 24).find((hour) => hasWetSignal(hour) || (hour.precipitationProbability ?? 0) >= 35);
  const rainPhrase = activeWet
    ? 'The current weather code is already flagging wet or stormy conditions.'
    : rainHour
      ? `The first meaningful rain signal appears near ${formatHour(rainHour.time, timeZone)}.`
      : 'There is no strong rain window in the selected period.';

  const heatPhrase =
    (feelsLike ?? 0) >= 88 ? `It will feel hot around ${Math.round(feelsLike ?? 0)} degrees, so comfort is capped.` : '';

  const sunshinePhrase =
    today?.sunshineDurationSeconds && today.daylightDurationSeconds
      ? `Sunshine quality is tracking near ${Math.round(
          (today.sunshineDurationSeconds / today.daylightDurationSeconds) * 100,
        )} percent of daylight.`
      : '';

  const airPhrase =
    airQuality?.peakAqi != null && airQuality.peakAqi > 50
      ? `Air quality peaks around ${Math.round(airQuality.peakAqi)} on the US index (${airQuality.category.toLowerCase()}).`
      : '';

  const reasonPhrase = score.reasons.length
    ? score.reasons.slice(0, 3).join(' ')
    : 'The model signal is fairly balanced.';

  const windowPhrase = bestWindow ? `${bestWindow.detail}` : '';

  const paragraph = `${label} at ${finalScore}/100. ${reasonPhrase} ${rainPhrase} ${heatPhrase} ${sunshinePhrase} ${airPhrase} ${windowPhrase}`
    .replace(/\s+/g, ' ')
    .trim();

  const recommendations = [...score.recommendations];
  if (betterDay) {
    recommendations.push(`If the plan can move, ${betterDay.label} currently looks materially better.`);
  }
  if (!recommendations.length && bestWindow && bestWindow.score >= 70) {
    recommendations.push(`Aim for the ${formatHour(bestWindow.startTime, timeZone)} window if you have the choice.`);
  }

  return {
    headline,
    paragraph,
    positives: score.positives,
    negatives: score.negatives,
    recommendations: recommendations.slice(0, 4),
    bestWindow,
    betterDay,
  };
};
