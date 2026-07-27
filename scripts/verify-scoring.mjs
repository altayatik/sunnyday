/**
 * Scoring and consensus verification.
 *
 * The app has no test runner and no test dependencies, but the scoring,
 * consensus, insight, and scene logic is exactly the kind of code that
 * breaks silently - a wrong number still renders perfectly. This script
 * compiles those modules with the TypeScript already in devDependencies and
 * asserts against them, so `npm run verify` needs nothing new installed.
 *
 * Run with: npm run verify
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = mkdtempSync(join(tmpdir(), 'sunnyday-verify-'));

const compile = () => {
  const sources = [
    'src/lib/weather/sunnyDayScore.ts',
    'src/lib/weather/insights.ts',
    'src/lib/weather/weatherScene.ts',
    'src/lib/weather/normalizeOpenMeteo.ts',
    'src/lib/weather/forecastConsensus.ts',
    'src/lib/weather/confidence.ts',
  ];
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'tsc',
      '--ignoreConfig',
      ...sources,
      '--outDir',
      outDir,
      // CommonJS output resolves the extensionless relative imports that the
      // source uses; ESM output would need every import rewritten.
      '--module',
      'commonjs',
      '--target',
      'es2022',
      '--moduleResolution',
      'node',
      '--skipLibCheck',
      '--ignoreDeprecations',
      '6.0',
    ],
    { stdio: 'pipe' },
  );
};

try {
  compile();
} catch (error) {
  // tsc exits non-zero on deprecation notices while still emitting.
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  if (/error TS(?!5107|5112)/.test(output)) {
    console.error(output);
    rmSync(outDir, { recursive: true, force: true });
    process.exit(1);
  }
}

// The emitted files are CommonJS, so they need a CJS require even though this
// script itself is an ES module. A local package.json marks the temp tree as
// CommonJS regardless of the repo's "type": "module".
writeFileSync(join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));
const load = createRequire(join(outDir, 'verify.cjs'));

const { scoreSunnyDay, labelForScore } = load('./lib/weather/sunnyDayScore.js');
const { buildInsights, findBestWindow } = load('./lib/weather/insights.js');
const { deriveScene } = load('./lib/weather/weatherScene.js');
const { normalizeOpenMeteo, rescoreSummary, applyAirQuality } = load('./lib/weather/normalizeOpenMeteo.js');
const { applyModelConsensus } = load('./lib/weather/forecastConsensus.js');
const { calculateConfidence } = load('./lib/weather/confidence.js');

let passed = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const group = (name) => console.log(`\n  ${name}`);

const DATE = '2026-07-27';

const hour = (overrides = {}) => ({
  time: `${DATE}T12:00`,
  temperatureF: 74,
  apparentTemperatureF: 74,
  humidity: 45,
  precipitationProbability: 0,
  precipitationInches: 0,
  rainInches: 0,
  showersInches: 0,
  cloudCover: 10,
  lowCloudCover: 5,
  midCloudCover: 5,
  highCloudCover: 5,
  uvIndex: 4,
  windSpeedMph: 6,
  windGustMph: 10,
  weatherCode: 0,
  isDay: true,
  visibilityMeters: 24000,
  conditionLabel: 'Mostly sunny',
  conditionIcon: 'sun',
  ...overrides,
});

const day = (overrides = {}) => ({
  date: DATE,
  conditionLabel: 'Mostly sunny',
  conditionIcon: 'sun',
  precipitationProbabilityMax: 0,
  precipitationSumInches: 0,
  temperatureMaxF: 78,
  temperatureMinF: 60,
  uvIndexMax: 5,
  sunrise: `${DATE}T05:30`,
  sunset: `${DATE}T20:25`,
  daylightDurationSeconds: 53700,
  sunshineDurationSeconds: 45000,
  ...overrides,
});

const series = (count, build = () => ({})) =>
  Array.from({ length: count }, (_, index) =>
    hour({ time: `${DATE}T${String(9 + index).padStart(2, '0')}:00`, ...build(index) }),
  );

const cleanAir = {
  usAqi: 20,
  europeanAqi: 15,
  category: 'Good',
  categoryLevel: 1,
  pm25: 5,
  pm10: 9,
  ozone: 40,
  nitrogenDioxide: 8,
  peakAqi: 22,
  dominantPollutant: 'Ozone',
  pollen: [],
  peakPollen: null,
  pollenAvailable: false,
};
const badAir = { ...cleanAir, usAqi: 175, peakAqi: 186, category: 'Unhealthy', categoryLevel: 4 };

group('score');
const perfect = scoreSunnyDay(series(12), [day()]);
ok('a clear calm day scores well', perfect.score >= 88, `got ${perfect.score}`);
ok('positives are recorded', perfect.positives.length > 0);
ok('breakdown carries an air category', typeof perfect.breakdown.air === 'number');

const storm = scoreSunnyDay(
  series(12, () => ({ weatherCode: 95, precipitationProbability: 85, precipitationInches: 0.3, cloudCover: 95 })),
  [day({ precipitationProbabilityMax: 85 })],
);
ok('an active storm is capped low', storm.score <= 25, `got ${storm.score}`);
ok('a storm produces advice', storm.recommendations.length > 0);

group('air quality');
const withClean = scoreSunnyDay(series(12), [day()], [], cleanAir);
const withBad = scoreSunnyDay(series(12), [day()], [], badAir);
ok('unhealthy air lowers the score', withBad.score < withClean.score - 20, `${withClean.score} -> ${withBad.score}`);
ok('unhealthy air caps the score', withBad.score <= 52, `got ${withBad.score}`);
ok('absent air data is neutral, not bad', scoreSunnyDay(series(12), [day()]).breakdown.air === 100);

group('alerts');
const tornado = scoreSunnyDay(series(12), [day()], [{ id: 'a', event: 'Tornado Warning' }]);
ok('a tornado warning dominates', tornado.score <= 8, `got ${tornado.score}`);
ok('the alert leads the negatives', tornado.negatives[0]?.tone === 'alert');

group('best outdoor window');
const mixed = series(12, (index) =>
  index >= 3 && index <= 6
    ? { precipitationProbability: 85, cloudCover: 95, weatherCode: 61, conditionLabel: 'Rain' }
    : {},
);
const window = findBestWindow(mixed, 'America/Chicago');
ok('a window is found', Boolean(window));
ok(
  'the window avoids the rain block',
  window && !(window.startTime >= mixed[3].time && window.startTime <= mixed[6].time),
  `start ${window?.startTime}`,
);
ok('the window spans at least two hours', window && window.hours >= 2);
ok('no window without data', findBestWindow([], 'UTC') === null);

group('scene derivation');
for (const [expected, candidate] of [
  ['clear-day', hour({ cloudCover: 5 })],
  ['partly-cloudy-day', hour({ cloudCover: 45 })],
  ['cloudy', hour({ cloudCover: 75 })],
  ['overcast', hour({ cloudCover: 95 })],
  ['clear-night', hour({ cloudCover: 10, isDay: false })],
  ['partly-cloudy-night', hour({ cloudCover: 70, isDay: false })],
  ['fog', hour({ weatherCode: 45 })],
  ['rain', hour({ weatherCode: 61, precipitationProbability: 70 })],
  ['showers', hour({ weatherCode: 81, precipitationProbability: 70 })],
  ['storm', hour({ weatherCode: 95, precipitationProbability: 60 })],
  ['snow', hour({ weatherCode: 73 })],
]) {
  const got = deriveScene(candidate, day(), null, false);
  ok(`scene ${expected}`, got === expected, `got ${got}`);
}
ok('scene heat', deriveScene(hour({ cloudCover: 20 }), day(), 104, false) === 'heat');
ok('scene heat via alert', deriveScene(hour({ cloudCover: 20 }), day(), 88, true) === 'heat');
ok('scene is null-safe', deriveScene(null, undefined, null, false) === 'clear-day');

group('insights');
const mixedDaily = [day({ precipitationProbabilityMax: 85 }), day({ date: '2026-07-28', precipitationProbabilityMax: 0, sunshineDurationSeconds: 52000 })];
const mixedScore = scoreSunnyDay(mixed, mixedDaily);
const insights = buildInsights(
  mixedScore,
  mixedScore.score,
  mixedScore.label,
  mixed[0],
  mixed,
  mixedDaily,
  DATE,
  'America/Chicago',
  [],
  badAir,
);
ok('the headline is substantive', insights.headline.length > 20);
ok('the paragraph is substantive', insights.paragraph.length > 40);
ok('the paragraph has no double spaces', !/\s{2,}/.test(insights.paragraph));
ok('recommendations are capped', insights.recommendations.length <= 4);
ok('a better day is offered', insights.betterDay !== null);

const goodInsights = buildInsights(perfect, perfect.score, perfect.label, hour(), series(12), [day()], DATE, 'UTC');
ok('no better day is pushed on a good day', goodInsights.betterDay === null);

group('labels');
ok('90+ is a great day', labelForScore(95) === 'Great SunnyDay');
ok('55-74 is mixed', labelForScore(60) === 'Mixed');
ok('under 35 is stay inside', labelForScore(10) === 'Stay Inside');

// ---------------------------------------------------------------------------
// End-to-end through the real normaliser and consensus engine.
// ---------------------------------------------------------------------------

const makeResponse = ({ cloud = 15, pop = 5, code = 0, temp = 76, hours = 24 } = {}) => {
  const time = [];
  const fill = (value) => Array.from({ length: hours }, (_, i) => (typeof value === 'function' ? value(i) : value));
  for (let i = 0; i < hours; i += 1) time.push(`${DATE}T${String(i).padStart(2, '0')}:00`);
  return {
    latitude: 41.85,
    longitude: -87.65,
    timezone: 'America/Chicago',
    hourly: {
      time,
      temperature_2m: fill(temp),
      apparent_temperature: fill(temp),
      relative_humidity_2m: fill(45),
      precipitation_probability: fill(pop),
      precipitation: fill(0),
      rain: fill(0),
      showers: fill(0),
      weather_code: fill(code),
      cloud_cover: fill(cloud),
      cloud_cover_low: fill(5),
      cloud_cover_mid: fill(5),
      cloud_cover_high: fill(5),
      wind_speed_10m: fill(7),
      wind_gusts_10m: fill(12),
      uv_index: fill((i) => (i > 8 && i < 18 ? 5 : 0)),
      is_day: fill((i) => (i >= 6 && i < 20 ? 1 : 0)),
      visibility: fill(24000),
    },
    daily: {
      time: [DATE, '2026-07-28'],
      weather_code: [code, 0],
      temperature_2m_max: [temp + 4, 80],
      temperature_2m_min: [60, 61],
      precipitation_probability_max: [pop, 0],
      precipitation_sum: [0, 0],
      sunrise: [`${DATE}T05:30`, '2026-07-28T05:31'],
      sunset: [`${DATE}T20:25`, '2026-07-28T20:24'],
      daylight_duration: [53700, 53600],
      sunshine_duration: [45000, 46000],
      uv_index_max: [5, 6],
    },
  };
};

const location = { name: 'Chicago', admin1: 'Illinois', latitude: 41.85, longitude: -87.65, timezone: 'America/Chicago' };

group('normaliser wiring');
const base = normalizeOpenMeteo(makeResponse(), location, DATE);
ok('insights are attached', Boolean(base.insights?.headline));
ok('breakdown is attached', typeof base.breakdown.precipitation === 'number');
ok('scene is attached', typeof base.scene === 'string');
ok('air quality source starts loading', base.sources.airQuality === 'loading');
ok('the prose matches the insight paragraph', base.aiInsight === base.insights.paragraph);

group('consensus: models with missing fields');
const model = (id, label, weight, stripFields = false) => {
  const response = makeResponse();
  if (stripFields) {
    response.hourly.wind_gusts_10m = response.hourly.wind_gusts_10m.map(() => null);
    response.hourly.relative_humidity_2m = response.hourly.relative_humidity_2m.map(() => null);
  }
  return { id, label, agency: 'test', weight, summary: normalizeOpenMeteo(response, location, DATE) };
};

// Seven models that agree on everything, three of which are missing the gust
// and humidity series. This is the regression test for the bug where an
// empty average returned 0 and manufactured a huge disagreement.
const agreeing = [
  model('ecmwf_ifs025', 'ECMWF', 1.25),
  model('gfs_seamless', 'GFS', 1.1),
  model('icon_seamless', 'ICON', 1.1),
  model('ukmo_seamless', 'UKMO', 1, true),
  model('meteofrance_seamless', 'Météo-France', 0.9, true),
  model('gem_seamless', 'GEM', 0.9, true),
  model('jma_seamless', 'JMA', 0.8),
];
const consensus = applyModelConsensus(base, agreeing);
ok('all seven models are counted', consensus.accuracy.sourceCount === 7);
ok('all seven are covered', consensus.accuracy.coveredCount === 7);
ok('agreeing models read as high confidence', consensus.accuracy.label === 'High', `got ${consensus.accuracy.label} @ ${consensus.accuracy.score}`);
ok('missing fields do not sink confidence', consensus.accuracy.score >= 95, `got ${consensus.accuracy.score}`);
ok('the consensus band is tight', consensus.accuracy.scoreHigh - consensus.accuracy.scoreLow <= 3);

group('consensus: genuine disagreement');
const disagreeing = [
  { id: 'a', label: 'A', agency: 'test', weight: 1.25, summary: normalizeOpenMeteo(makeResponse({ cloud: 5, pop: 0 }), location, DATE) },
  { id: 'b', label: 'B', agency: 'test', weight: 1.1, summary: normalizeOpenMeteo(makeResponse({ cloud: 95, pop: 90, code: 61, temp: 60 }), location, DATE) },
  { id: 'c', label: 'C', agency: 'test', weight: 1.1, summary: normalizeOpenMeteo(makeResponse({ cloud: 50, pop: 45, temp: 88 }), location, DATE) },
];
const disagreement = applyModelConsensus(base, disagreeing);
ok('disagreement lowers confidence', disagreement.accuracy.score < consensus.accuracy.score - 25);
ok('disagreement widens the band', disagreement.accuracy.scoreHigh - disagreement.accuracy.scoreLow > 5);

group('consensus: coverage');
const twoModels = applyModelConsensus(base, agreeing.slice(0, 2));
ok('two models cannot reach full confidence', twoModels.accuracy.score <= 80, `got ${twoModels.accuracy.score}`);

const emptyResponse = makeResponse();
for (const field of ['temperature_2m', 'precipitation_probability']) {
  emptyResponse.hourly[field] = emptyResponse.hourly[field].map(() => null);
}
const withEmpty = applyModelConsensus(base, [
  ...agreeing.slice(0, 3),
  { id: 'empty', label: 'Empty', agency: 'test', weight: 1, summary: normalizeOpenMeteo(emptyResponse, location, DATE) },
]);
ok('an empty model is flagged uncovered', withEmpty.accuracy.sources.some((source) => !source.covered));
ok('an empty model is excluded from the count', withEmpty.accuracy.coveredCount === 3);
ok('an empty model does not sink confidence', withEmpty.accuracy.score >= 80, `got ${withEmpty.accuracy.score}`);

group('rescore keeps the summary internally consistent');
const air = {
  usAqi: 180,
  europeanAqi: 90,
  category: 'Unhealthy',
  categoryLevel: 4,
  pm25: 80,
  pm10: 110,
  ozone: 150,
  nitrogenDioxide: 40,
  peakAqi: 190,
  dominantPollutant: 'PM2.5',
  pollen: [],
  peakPollen: null,
  pollenAvailable: false,
};
const withAir = applyAirQuality(consensus, air);
ok('air quality lowers the final score', withAir.sunnyDayScore < consensus.sunnyDayScore);
ok('the air breakdown updates', withAir.breakdown.air < 100);
ok('the prose mentions air quality', /air quality/i.test(withAir.insights.paragraph + withAir.insights.headline));
ok('model accuracy survives the rescore', withAir.accuracy.score === consensus.accuracy.score);
ok('the consensus base survives the rescore', withAir.consensusBaseScore === consensus.consensusBaseScore);

const alerted = rescoreSummary(withAir, [{ id: 't', event: 'Tornado Warning' }], air);
ok('an alert caps the rescored score', alerted.sunnyDayScore <= 8);
ok('the alert reaches the headline', /tornado/i.test(alerted.insights.headline));
ok('the label follows the score', alerted.scoreLabel === 'Stay Inside');

const flashFlood = rescoreSummary(
  { ...consensus, consensusBaseScore: 60 },
  [{ id: 'f', event: 'Flash Flood Warning' }],
);
ok(
  'an alert caps consensus instead of subtracting its penalty twice',
  flashFlood.sunnyDayScore === 25,
  `got ${flashFlood.sunnyDayScore}`,
);

const twice = rescoreSummary(rescoreSummary(withAir));
ok('rescoring is idempotent', twice.sunnyDayScore === withAir.sunnyDayScore);


group('confidence model');
const normalAgreement = {
  coveredCount: 7, sourceCount: 7,
  temperatureSpreadF: 3, precipitationSpread: 15, cloudSpread: 18, gustSpread: 6,
  scoreSpread: 8, conditionAgreement: 1, leadDays: 0,
};
const todayConfidence = calculateConfidence(normalAgreement);
ok('normal agreement today reads High', todayConfidence.label === 'High', `got ${todayConfidence.label} @ ${todayConfidence.score}`);
ok('normal agreement today scores >= 95', todayConfidence.score >= 95, `got ${todayConfidence.score}`);

const daySix = calculateConfidence({ ...normalAgreement, leadDays: 6 });
ok('day six is capped below today', daySix.score < todayConfidence.score, `${todayConfidence.score} vs ${daySix.score}`);
ok('day six is still usable', daySix.score >= 70, `got ${daySix.score}`);

const splitOnRain = calculateConfidence({ ...normalAgreement, conditionAgreement: 0.5 });
ok('splitting on rain costs real confidence', splitOnRain.score < todayConfidence.score - 8, `${todayConfidence.score} vs ${splitOnRain.score}`);

const wildDisagreement = calculateConfidence({
  ...normalAgreement, temperatureSpreadF: 22, precipitationSpread: 80,
  cloudSpread: 90, gustSpread: 30, scoreSpread: 55, conditionAgreement: 0.34,
});
ok('genuine disagreement reads Low or Mixed', ['Low', 'Mixed'].includes(wildDisagreement.label), `got ${wildDisagreement.label} @ ${wildDisagreement.score}`);

const twoCovered = calculateConfidence({ ...normalAgreement, coveredCount: 2 });
ok('two models cannot exceed their ceiling', twoCovered.score <= 80, `got ${twoCovered.score}`);

const noSpreads = calculateConfidence({
  ...normalAgreement, temperatureSpreadF: null, precipitationSpread: null,
  cloudSpread: null, gustSpread: null, scoreSpread: null,
});
ok('absent spreads do not penalise', noSpreads.score >= 95, `got ${noSpreads.score}`);

rmSync(outDir, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
