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
  rainViewer: SourceState;
  nws: SourceState;
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
  sources: SunnyDaySources;
  rainViewer?: RainViewerData;
  nwsAlerts?: NwsAlert[];
  generatedAt: string;
};
