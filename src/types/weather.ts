export type SourceState = 'ok' | 'error' | 'unavailable' | 'loading';

export type LocationResult = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type HourlySunnyData = {
  time: string;
  temperatureF: number | null;
  apparentTemperatureF: number | null;
  humidity: number | null;
  precipitationProbability: number | null;
  precipitationInches: number | null;
  rainInches: number | null;
  showersInches: number | null;
  cloudCover: number | null;
  lowCloudCover: number | null;
  midCloudCover: number | null;
  highCloudCover: number | null;
  uvIndex: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  weatherCode: number | null;
  isDay: boolean | null;
  visibilityMeters: number | null;
  conditionLabel: string;
  conditionIcon: string;
};

export type DailySunnyData = {
  date: string;
  conditionLabel: string;
  conditionIcon: string;
  precipitationProbabilityMax: number | null;
  precipitationSumInches: number | null;
  temperatureMaxF: number | null;
  temperatureMinF: number | null;
  uvIndexMax: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylightDurationSeconds: number | null;
  sunshineDurationSeconds: number | null;
};

export type ScoreLabel = 'Great SunnyDay' | 'Pretty Good' | 'Mixed' | 'Risky' | 'Stay Inside';

export type SunnyDaySources = {
  openMeteo: SourceState;
  models: SourceState;
  rainViewer: SourceState;
  nws: SourceState;
  airQuality: SourceState;
};

export type ForecastSourceScore = {
  id: string;
  label: string;
  score: number;
  /** False when the model returned no usable data for the selected day. */
  covered: boolean;
};

export type ForecastAccuracy = {
  score: number;
  label: 'High' | 'Good' | 'Mixed' | 'Low';
  summary: string;
  sourceCount: number;
  /** Models that actually returned data for the selected day. */
  coveredCount: number;
  temperatureSpreadF: number;
  precipitationSpread: number;
  cloudSpread: number;
  scoreSpread: number;
  /** Interquartile range of model scores; drives the consensus band. */
  scoreInterquartileRange: number;
  /** Low/high consensus band shown as an uncertainty range on the score. */
  scoreLow: number;
  scoreHigh: number;
  conditionAgreement: number;
  sources: ForecastSourceScore[];
};

export type PollenKind = 'alder' | 'birch' | 'grass' | 'mugwort' | 'olive' | 'ragweed';

export type PollenReading = {
  kind: PollenKind;
  label: string;
  grainsPerM3: number;
  /** 0 = none, 1 = low, 2 = moderate, 3 = high, 4 = very high. */
  level: number;
  levelLabel: string;
};

export type AirQualityData = {
  /** US AQI at the reference hour. Null when the provider has no coverage. */
  usAqi: number | null;
  europeanAqi: number | null;
  category: string;
  categoryLevel: number;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  nitrogenDioxide: number | null;
  /** Peak US AQI across the scoring window. */
  peakAqi: number | null;
  dominantPollutant: string | null;
  pollen: PollenReading[];
  peakPollen: PollenReading | null;
  /** Open-Meteo only models pollen over Europe. */
  pollenAvailable: boolean;
};

export type RainViewerFrame = {
  time: number;
  path: string;
};

export type RainViewerData = {
  host: string;
  frames: RainViewerFrame[];
  latestFrame: RainViewerFrame | null;
};

export type NwsAlert = {
  id: string;
  event: string;
  severity?: string;
  headline?: string;
};

/** Mirrors `WeatherScene` in SunnyDay iOS. */
export type WeatherSceneId =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'showers'
  | 'storm'
  | 'snow'
  | 'heat';

export type InsightTone = 'sun' | 'rain' | 'cloud' | 'comfort' | 'uv' | 'wind' | 'air' | 'alert' | 'neutral';

export type InsightFactor = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  tone: InsightTone;
  /** Points this factor cost the score. 0 for positives. */
  points: number;
};

export type OutdoorWindow = {
  startTime: string;
  endTime: string;
  hours: number;
  score: number;
  label: string;
  detail: string;
};

export type InsightBundle = {
  /** One-to-three sentence headline read, shown on the hero. */
  headline: string;
  /** The longer connected paragraph shown on the Today page. */
  paragraph: string;
  positives: InsightFactor[];
  negatives: InsightFactor[];
  recommendations: string[];
  bestWindow: OutdoorWindow | null;
  /** Ranked alternative days when today is poor. */
  betterDay: { date: string; score: number; label: string } | null;
};

export type SunnyDaySummary = {
  location: LocationResult;
  selectedDate: string;
  current: HourlySunnyData;
  hourly: HourlySunnyData[];
  scoringHourly: HourlySunnyData[];
  daily: DailySunnyData[];
  sunnyDayScore: number;
  scoreLabel: ScoreLabel;
  summaryText: string;
  aiInsight: string;
  reasons: string[];
  insights: InsightBundle;
  breakdown: ScoreBreakdown;
  scene: WeatherSceneId;
  consensusBaseScore?: number;
  accuracy?: ForecastAccuracy;
  airQuality?: AirQualityData;
  sources: SunnyDaySources;
  rainViewer?: RainViewerData;
  nwsAlerts?: NwsAlert[];
  generatedAt: string;
};

export type ScoreBreakdown = {
  sky: number;
  precipitation: number;
  comfort: number;
  safety: number;
  air: number;
};
