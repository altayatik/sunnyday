import type { DailySunnyData, HourlySunnyData, WeatherSceneId } from '../../types/weather';

const stormCodes = new Set([95, 96, 99]);
const snowCodes = new Set([71, 73, 75, 77, 85, 86]);
const showerCodes = new Set([80, 81, 82]);
const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const fogCodes = new Set([45, 48]);

/**
 * Port of `WeatherScene.derive` from SunnyDay iOS.
 *
 * The web app previously chose its background by running a regex over the
 * human-readable condition label, which meant "Overcast night" and "Clear
 * night" collapsed to the same look, a heat wave looked identical to a mild
 * sunny day, and any label wording change silently altered the visuals.
 * Deriving from the numbers instead keeps both platforms in step.
 */
export const deriveScene = (
  current: HourlySunnyData | null,
  day: DailySunnyData | undefined,
  apparentHigh: number | null,
  hasHeatAlert = false,
): WeatherSceneId => {
  if (!current) return 'clear-day';

  const cloudCover = current.cloudCover ?? 0;
  const precipitationProbability = current.precipitationProbability ?? day?.precipitationProbabilityMax ?? 0;
  const precipitationAmount = current.precipitationInches ?? 0;
  const weatherCode = current.weatherCode ?? -1;
  const isNight = current.isDay === false;
  const feelsLike = apparentHigh ?? current.apparentTemperatureF ?? current.temperatureF ?? 0;
  const heatSignal = hasHeatAlert || feelsLike >= 100;

  if (stormCodes.has(weatherCode) && precipitationProbability >= 30) return 'storm';
  if (snowCodes.has(weatherCode)) return 'snow';
  if (fogCodes.has(weatherCode)) return 'fog';

  if (rainCodes.has(weatherCode) || precipitationAmount >= 0.02 || precipitationProbability >= 60) {
    return showerCodes.has(weatherCode) ? 'showers' : 'rain';
  }

  if (isNight) return cloudCover >= 55 ? 'partly-cloudy-night' : 'clear-night';
  if (heatSignal && cloudCover < 68 && precipitationProbability < 35) return 'heat';

  if (cloudCover < 30) return 'clear-day';
  if (cloudCover < 68) return 'partly-cloudy-day';
  if (cloudCover < 86) return 'cloudy';
  return 'overcast';
};

export const sceneIsNight = (scene: WeatherSceneId) => scene === 'clear-night' || scene === 'partly-cloudy-night';

/** Scenes that want a dark UI treatment behind the glass panels. */
export const scenePrefersDark = (scene: WeatherSceneId) => sceneIsNight(scene) || scene === 'storm';
