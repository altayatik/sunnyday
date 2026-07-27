import { Flower2, Wind } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';

type AirQualityPanelProps = {
  summary: SunnyDaySummary;
};

/** Colour band for the US AQI scale. */
const aqiTone = (level: number) => {
  if (level <= 1) return 'text-emerald-200';
  if (level === 2) return 'text-amber-200';
  if (level === 3) return 'text-orange-200';
  if (level === 4) return 'text-rose-200';
  return 'text-fuchsia-200';
};

const pollenTone = (level: number) => {
  if (level <= 1) return 'bg-emerald-300/20 text-emerald-100';
  if (level === 2) return 'bg-amber-300/20 text-amber-100';
  if (level === 3) return 'bg-orange-300/22 text-orange-100';
  return 'bg-rose-300/22 text-rose-100';
};

const value = (reading: number | null, unit: string) =>
  reading === null ? '—' : `${Math.round(reading)} ${unit}`;

export function AirQualityPanel({ summary }: AirQualityPanelProps) {
  const air = summary.airQuality;

  if (!air) {
    return (
      <section className="surface-panel @container p-4 sm:p-5">
        <h2 className="panel-title flex items-center gap-2">
          <Wind aria-hidden="true" className="accent-text size-4" />
          Air Quality
        </h2>
        <p className="panel-caption mt-3">
          {summary.sources.airQuality === 'loading'
            ? 'Loading air quality and pollen data.'
            : 'Air quality data is not available for this location.'}
        </p>
      </section>
    );
  }

  const aqi = air.usAqi ?? air.peakAqi;

  return (
    <section className="surface-panel @container p-4 sm:p-5">
      <h2 className="panel-title flex items-center gap-2">
        <Wind aria-hidden="true" className="accent-text size-4" />
        Air Quality
      </h2>

      <div className="mt-3 flex items-end gap-3">
        <span className={`text-[2.75rem] font-black leading-none tabular-nums ${aqiTone(air.categoryLevel)}`}>
          {aqi === null ? '—' : Math.round(aqi)}
        </span>
        <div className="pb-1">
          <p className="text-sm font-bold text-white">{air.category}</p>
          <p className="text-xs text-white/60">
            US AQI{air.dominantPollutant ? ` • led by ${air.dominantPollutant}` : ''}
          </p>
        </div>
      </div>

      {air.peakAqi !== null && aqi !== null && air.peakAqi > aqi + 8 ? (
        <p className="mt-2 text-xs font-bold text-amber-100">
          Peaks near {Math.round(air.peakAqi)} later in the day.
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2 @xl:grid-cols-4">
        <div className="surface-inset p-3">
          <dt className="label-caps">PM2.5</dt>
          <dd className="mt-1 text-sm font-bold text-white">{value(air.pm25, 'µg/m³')}</dd>
        </div>
        <div className="surface-inset p-3">
          <dt className="label-caps">PM10</dt>
          <dd className="mt-1 text-sm font-bold text-white">{value(air.pm10, 'µg/m³')}</dd>
        </div>
        <div className="surface-inset p-3">
          <dt className="label-caps">Ozone</dt>
          <dd className="mt-1 text-sm font-bold text-white">{value(air.ozone, 'µg/m³')}</dd>
        </div>
        <div className="surface-inset p-3">
          <dt className="label-caps">NO₂</dt>
          <dd className="mt-1 text-sm font-bold text-white">{value(air.nitrogenDioxide, 'µg/m³')}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <h3 className="label-caps flex items-center gap-1.5">
          <Flower2 aria-hidden="true" className="size-3.5" />
          Pollen
        </h3>
        {air.pollenAvailable && air.pollen.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {air.pollen.map((reading) => (
              <span
                key={reading.kind}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${pollenTone(reading.level)}`}
              >
                {reading.label} {reading.levelLabel.toLowerCase()} • {reading.grainsPerM3}/m³
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[0.75rem] leading-5 text-white/52">
            {/* CAMS only models pollen over Europe, so silence here means "not
                measured", not "no pollen". Saying so avoids a false all-clear. */}
            Pollen is not modelled for this region, so no reading is shown rather than an assumed zero.
          </p>
        )}
      </div>
    </section>
  );
}
