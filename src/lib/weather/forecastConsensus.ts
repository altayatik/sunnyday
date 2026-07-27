import type { ForecastAccuracy, HourlySunnyData, SunnyDaySummary } from '../../types/weather';
import type { ModelForecast } from '../api/modelForecasts';
import { applyNwsAlerts } from './normalizeOpenMeteo';

const wetCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const stormCodes = new Set([95, 96, 99]);

const present = (values: Array<number | null | undefined>) =>
  values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

const average = (values: Array<number | null | undefined>) => {
  const valuesPresent = present(values);
  return valuesPresent.length ? valuesPresent.reduce((sum, value) => sum + value, 0) / valuesPresent.length : 0;
};

const spread = (values: Array<number | null | undefined>) => {
  const valuesPresent = present(values);
  return valuesPresent.length >= 2 ? Math.max(...valuesPresent) - Math.min(...valuesPresent) : 0;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const metricAverage = (
  hours: HourlySunnyData[],
  read: (hour: HourlySunnyData) => number | null | undefined,
) => average(hours.slice(0, 6).map(read));

const accuracyLabel = (score: number): ForecastAccuracy['label'] => {
  if (score >= 85) return 'High';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Mixed';
  return 'Low';
};

const calculateAccuracy = (models: ModelForecast[]): ForecastAccuracy => {
  const sourceMetrics = models.map(({ id, label, summary }) => ({
    id,
    label,
    score: summary.sunnyDayScore,
    temperature: metricAverage(summary.scoringHourly, (hour) => hour.temperatureF),
    precipitation: metricAverage(summary.scoringHourly, (hour) => hour.precipitationProbability),
    cloud: metricAverage(summary.scoringHourly, (hour) => hour.cloudCover),
    gust: metricAverage(summary.scoringHourly, (hour) => hour.windGustMph),
    condition: stormCodes.has(summary.current.weatherCode ?? -1)
      ? 'storm'
      : wetCodes.has(summary.current.weatherCode ?? -1)
        ? 'wet'
        : 'dry',
  }));

  const temperatureSpreadF = spread(sourceMetrics.map((source) => source.temperature));
  const precipitationSpread = spread(sourceMetrics.map((source) => source.precipitation));
  const cloudSpread = spread(sourceMetrics.map((source) => source.cloud));
  const gustSpread = spread(sourceMetrics.map((source) => source.gust));
  const scoreSpread = spread(sourceMetrics.map((source) => source.score));
  const conditionAgreement =
    sourceMetrics.length <= 1
      ? 1
      : Math.max(
          ...['dry', 'wet', 'storm'].map(
            (condition) => sourceMetrics.filter((source) => source.condition === condition).length / sourceMetrics.length,
          ),
        );

  const disagreementPenalty =
    Math.min(18, temperatureSpreadF * 1.5) +
    Math.min(22, precipitationSpread * 0.22) +
    Math.min(18, cloudSpread * 0.18) +
    Math.min(10, gustSpread * 0.35) +
    Math.min(22, scoreSpread * 0.55) +
    (1 - conditionAgreement) * 18;
  const coverageCeiling = sourceMetrics.length >= 3 ? 100 : sourceMetrics.length === 2 ? 82 : 55;
  const score = Math.round(Math.max(0, Math.min(coverageCeiling, 100 - disagreementPenalty)));
  const label = accuracyLabel(score);
  const summary =
    sourceMetrics.length >= 2
      ? `Accuracy confidence is ${score}/100 (${label.toLowerCase()} agreement) across ${sourceMetrics.length} models; temperature spread is ${Math.round(
          temperatureSpreadF,
        )}°, rain-probability spread is ${Math.round(precipitationSpread)} points, and SunnyDay-score spread is ${Math.round(
          scoreSpread,
        )} points.`
      : `Accuracy confidence is ${score}/100 because only ${sourceMetrics.length || 'no'} comparison model is available.`;

  return {
    score,
    label,
    summary,
    sourceCount: sourceMetrics.length,
    temperatureSpreadF: Math.round(temperatureSpreadF),
    precipitationSpread: Math.round(precipitationSpread),
    cloudSpread: Math.round(cloudSpread),
    scoreSpread: Math.round(scoreSpread),
    sources: sourceMetrics.map(({ id, label: sourceLabel, score: sourceScore }) => ({
      id,
      label: sourceLabel,
      score: sourceScore,
    })),
  };
};

export const applyModelConsensus = (summary: SunnyDaySummary, models: ModelForecast[]): SunnyDaySummary => {
  if (!models.length) return summary;

  const accuracy = calculateAccuracy(models);
  const modelScores = accuracy.sources.map((source) => source.score);
  let consensusBaseScore = models.length >= 2 ? median(modelScores) : summary.sunnyDayScore;
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
      consensusBaseScore: Math.round(consensusBaseScore),
      accuracy,
    },
    summary.nwsAlerts ?? [],
  );
};
