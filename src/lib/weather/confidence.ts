import { clamp } from './units';

/**
 * Confidence model.
 *
 * The previous version punished ordinary model behaviour. Two global models
 * disagreeing by 3°F on tomorrow's temperature is *excellent* agreement, but a
 * flat `spread * 1.5` charged 4.5 points for it. Stack four such terms and a
 * perfectly normal forecast reported "Mixed agreement" - which is exactly the
 * wishy-washy behaviour we are trying to avoid.
 *
 * Three changes make the number both higher and more meaningful:
 *
 * 1. **Tolerances.** Each metric gets a free band representing normal
 *    inter-model spread. Only disagreement beyond that band costs anything.
 * 2. **Lead time.** Models agree far more about this afternoon than about next
 *    Friday. Confidence is now capped by how far out the day is, which raises
 *    today and correctly lowers day six.
 * 3. **No double counting.** The SunnyDay score is *derived* from temperature,
 *    precipitation, and cloud, so charging full price for both the input
 *    spreads and the output score spread billed the same disagreement twice.
 *    Score spread now carries a reduced weight.
 */

export type ConfidenceInput = {
  /** Number of models that returned usable data for this day. */
  coveredCount: number;
  /** Total models attempted. */
  sourceCount: number;
  temperatureSpreadF: number | null;
  precipitationSpread: number | null;
  cloudSpread: number | null;
  gustSpread: number | null;
  scoreSpread: number | null;
  /** 0-1: share of models agreeing on dry / wet / storm. */
  conditionAgreement: number;
  /** Whole days from today to the selected day. */
  leadDays: number;
};

export type ConfidenceResult = {
  score: number;
  label: 'High' | 'Good' | 'Mixed' | 'Low';
};

/**
 * Charges nothing until the spread exceeds `tolerance`, then ramps linearly
 * up to `cap`. Below tolerance the models are, for our purposes, agreeing.
 */
type Tolerance = { tolerance: number; rate: number; cap: number };

const softPenalty = (spread: number | null, { tolerance, rate, cap }: Tolerance) => {
  if (spread === null || !Number.isFinite(spread)) return 0;
  return Math.min(cap, Math.max(0, spread - tolerance) * rate);
};

/**
 * Typical spread between global models at short range. Anything inside these
 * bands is normal weather-model behaviour, not a disagreement worth flagging.
 */
const tolerances: Record<'temperatureF' | 'precipitation' | 'cloud' | 'gust' | 'score', Tolerance> = {
  temperatureF: { tolerance: 4, rate: 1.4, cap: 16 },
  precipitation: { tolerance: 20, rate: 0.4, cap: 20 },
  cloud: { tolerance: 25, rate: 0.28, cap: 14 },
  gust: { tolerance: 9, rate: 0.5, cap: 8 },
  // Reduced weight: the score is derived from the metrics above, so a large
  // score spread is mostly a restatement of spreads already charged for.
  score: { tolerance: 12, rate: 0.5, cap: 16 },
};

/**
 * Ceiling by forecast lead time. Even seven models in perfect agreement about
 * next Friday deserve less confidence than seven models agreeing about the
 * next six hours, because agreement itself is less informative at range.
 */
const leadCeiling = (leadDays: number) => {
  const table = [100, 98, 95, 91, 87, 83, 79];
  const index = clamp(Math.round(leadDays), 0, table.length - 1);
  return table[index];
};

/** More models agreeing is stronger evidence than fewer models agreeing. */
const coverageCeiling = (coveredCount: number) => {
  if (coveredCount >= 6) return 100;
  if (coveredCount === 5) return 97;
  if (coveredCount === 4) return 94;
  if (coveredCount === 3) return 89;
  if (coveredCount === 2) return 80;
  if (coveredCount === 1) return 58;
  return 0;
};

export const confidenceLabel = (score: number): ConfidenceResult['label'] => {
  if (score >= 85) return 'High';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Mixed';
  return 'Low';
};

export const calculateConfidence = (input: ConfidenceInput): ConfidenceResult => {
  const penalty =
    softPenalty(input.temperatureSpreadF, tolerances.temperatureF) +
    softPenalty(input.precipitationSpread, tolerances.precipitation) +
    softPenalty(input.cloudSpread, tolerances.cloud) +
    softPenalty(input.gustSpread, tolerances.gust) +
    softPenalty(input.scoreSpread, tolerances.score) +
    // Models splitting on whether it rains at all is the single most
    // meaningful disagreement for this app, so it keeps full weight.
    (1 - input.conditionAgreement) * 22;

  const ceiling = Math.min(leadCeiling(input.leadDays), coverageCeiling(input.coveredCount));
  const score = Math.round(clamp(100 - penalty, 0, ceiling));

  return { score, label: confidenceLabel(score) };
};
