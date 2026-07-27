import type { ForecastAccuracy, ForecastSourceScore, HourlySunnyData, SunnyDaySummary } from '../../types/weather';
import type { ModelForecast } from '../api/modelForecasts';
import { applyNwsAlerts } from './normalizeOpenMeteo';
import { calculateConfidence } from './confidence';
import { clamp } from './units';
import { dateKeyInTimeZone } from '../date';

const wetCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const stormCodes = new Set([95, 96, 99]);

const present = (values: Array<number | null | undefined>) =>
  values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

/**
 * Returns null - not 0 - for an empty set.
 *
 * The previous implementation returned 0 here, which meant a model that
 * simply had no data for a field looked like it was forecasting zero. One
 * missing humidity or gust series then read as a huge disagreement and
 * collapsed the accuracy score, so the app reported "Low agreement"
 * precisely when it had the least reason to.
 */
const average = (values: Array<number | null | undefined>): number | null => {
  const valuesPresent = present(values);
  return valuesPresent.length ? valuesPresent.reduce((sum, value) => sum + value, 0) / valuesPresent.length : null;
};

/** Spread across models, ignoring models that had nothing to say. */
const spread = (values: Array<number | null | undefined>): number | null => {
  const valuesPresent = present(values);
  return valuesPresent.length >= 2 ? Math.max(...valuesPresent) - Math.min(...valuesPresent) : null;
};

const quantile = (sorted: number[], fraction: number) => {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/**
 * Weighted aggregate that drops the single most extreme model once enough of
 * them agree. A plain median throws away the ordering information we have
 * about model skill; a plain mean lets one wild outlier drag the score. This
 * trims the largest deviation from the median (only at 5+ models, where
 * losing one still leaves a real sample) and takes a weighted mean of the rest.
 */
const trimmedWeightedScore = (entries: Array<{ score: number; weight: number }>) => {
  if (!entries.length) return null;
  if (entries.length === 1) return entries[0].score;

  const sorted = entries.map((entry) => entry.score).sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);

  let kept = entries;
  if (entries.length >= 5) {
    const ranked = [...entries].sort((a, b) => Math.abs(b.score - median) - Math.abs(a.score - median));
    kept = ranked.slice(1);
  }

  const totalWeight = kept.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return median;
  return kept.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / totalWeight;
};

/**
 * Averages a field over the first `count` scoring hours. Returns null when
 * the model carries no values for that field, so the caller can tell "no
 * data" apart from "forecasting zero".
 */
const metricAverage = (
  hours: HourlySunnyData[],
  read: (hour: HourlySunnyData) => number | null | undefined,
  count = 6,
) => average(hours.slice(0, count).map(read));

type SourceMetrics = {
  id: string;
  label: string;
  weight: number;
  score: number;
  covered: boolean;
  temperature: number | null;
  precipitation: number | null;
  cloud: number | null;
  gust: number | null;
  condition: 'dry' | 'wet' | 'storm';
};

const buildMetrics = (models: ModelForecast[]): SourceMetrics[] =>
  models.map(({ id, label, weight, summary }) => {
    const hours = summary.scoringHourly;
    const covered = hours.some((hour) => hour.temperatureF !== null || hour.precipitationProbability !== null);
    const code = summary.current.weatherCode ?? -1;

    return {
      id,
      label,
      weight,
      score: summary.sunnyDayScore,
      covered,
      temperature: metricAverage(hours, (hour) => hour.temperatureF),
      precipitation: metricAverage(hours, (hour) => hour.precipitationProbability),
      cloud: metricAverage(hours, (hour) => hour.cloudCover),
      gust: metricAverage(hours, (hour) => hour.windGustMph),
      condition: stormCodes.has(code) ? 'storm' : wetCodes.has(code) ? 'wet' : 'dry',
    };
  });

const calculateAccuracy = (metrics: SourceMetrics[], leadDays: number): ForecastAccuracy => {
  const covered = metrics.filter((source) => source.covered);
  const scores = covered.map((source) => source.score).sort((a, b) => a - b);

  const temperatureSpreadF = spread(covered.map((source) => source.temperature));
  const precipitationSpread = spread(covered.map((source) => source.precipitation));
  const cloudSpread = spread(covered.map((source) => source.cloud));
  const gustSpread = spread(covered.map((source) => source.gust));
  const scoreSpread = spread(covered.map((source) => source.score));
  const interquartileRange = scores.length >= 4 ? quantile(scores, 0.75) - quantile(scores, 0.25) : (scoreSpread ?? 0);

  const conditionAgreement =
    covered.length <= 1
      ? 1
      : Math.max(
          ...(['dry', 'wet', 'storm'] as const).map(
            (condition) => covered.filter((source) => source.condition === condition).length / covered.length,
          ),
        );

  const { score, label } = calculateConfidence({
    coveredCount: covered.length,
    sourceCount: metrics.length,
    temperatureSpreadF,
    precipitationSpread,
    cloudSpread,
    gustSpread,
    scoreSpread,
    conditionAgreement,
    leadDays,
  });

  const consensusScore = trimmedWeightedScore(covered.map(({ score: value, weight }) => ({ score: value, weight })));
  const band = interquartileRange / 2;
  const centre = consensusScore ?? 0;
  const scoreLow = Math.round(clamp(centre - band, 0, 100));
  const scoreHigh = Math.round(clamp(centre + band, 0, 100));

  const summary =
    covered.length >= 2
      ? `Accuracy confidence is ${score}/100 (${label.toLowerCase()} agreement) across ${covered.length} models. Temperature spread is ${Math.round(
          temperatureSpreadF ?? 0,
        )}°, rain-probability spread is ${Math.round(
          precipitationSpread ?? 0,
        )} points, and the models place the SunnyDay score between ${scoreLow} and ${scoreHigh}.`
      : `Accuracy confidence is ${score}/100 because only ${covered.length || 'no'} comparison model returned data for this day.`;

  const sources: ForecastSourceScore[] = metrics.map(
    ({ id, label: sourceLabel, score: sourceScore, covered: isCovered }) => ({
      id,
      label: sourceLabel,
      score: sourceScore,
      covered: isCovered,
    }),
  );

  return {
    score,
    label,
    summary,
    sourceCount: metrics.length,
    coveredCount: covered.length,
    temperatureSpreadF: Math.round(temperatureSpreadF ?? 0),
    precipitationSpread: Math.round(precipitationSpread ?? 0),
    cloudSpread: Math.round(cloudSpread ?? 0),
    scoreSpread: Math.round(scoreSpread ?? 0),
    scoreInterquartileRange: Math.round(interquartileRange),
    scoreLow,
    scoreHigh,
    conditionAgreement,
    sources,
  };
};

export const applyModelConsensus = (summary: SunnyDaySummary, models: ModelForecast[]): SunnyDaySummary => {
  if (!models.length) return summary;

  const metrics = buildMetrics(models);
  const covered = metrics.filter((source) => source.covered);

  // Days between today and the selected day, in the location's timezone.
  const today = dateKeyInTimeZone(new Date(), summary.location.timezone);
  const leadDays = Math.max(
    0,
    Math.round(
      (Date.parse(`${summary.selectedDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000,
    ),
  );
  const accuracy = calculateAccuracy(metrics, leadDays);

  let consensusBaseScore =
    covered.length >= 2
      ? (trimmedWeightedScore(covered.map(({ score, weight }) => ({ score, weight }))) ?? summary.sunnyDayScore)
      : summary.sunnyDayScore;

  // When the models disagree sharply, pull the consensus back toward the
  // primary blended run rather than trusting a spread-out weighted mean.
  // High disagreement is exactly when the aggregate means least.
  if (accuracy.score < 55 && covered.length >= 2) {
    consensusBaseScore = consensusBaseScore * 0.6 + summary.sunnyDayScore * 0.4;
  }

  const activeStormCount = models.filter((model) => stormCodes.has(model.summary.current.weatherCode ?? -1)).length;
  const heavyWetCount = models.filter((model) => {
    const current = model.summary.current;
    return wetCodes.has(current.weatherCode ?? -1) && (current.precipitationInches ?? 0) >= 0.1;
  }).length;

  if (activeStormCount >= 2) consensusBaseScore = Math.min(consensusBaseScore, 25);
  else if (activeStormCount === 1) consensusBaseScore = Math.min(consensusBaseScore, 34);
  else if (heavyWetCount >= 2) consensusBaseScore = Math.min(consensusBaseScore, 40);

  return applyNwsAlerts(
    {
      ...summary,
      consensusBaseScore: Math.round(clamp(consensusBaseScore, 0, 100)),
      accuracy,
    },
    summary.nwsAlerts ?? [],
  );
};
