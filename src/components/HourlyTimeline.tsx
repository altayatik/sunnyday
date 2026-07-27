import { Droplets, Gauge, SunMedium } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';
import { formatHour } from '../lib/date';
import { percent } from '../lib/weather/units';
import { WeatherIcon } from './WeatherIcon';

type HourlyTimelineProps = {
  summary: SunnyDaySummary;
};

export function HourlyTimeline({ summary }: HourlyTimelineProps) {
  return (
    <section className="surface-panel p-4 sm:p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="panel-title">Next 12 hours</h2>
          <p className="panel-caption">Rain, clouds, UV, and humidity.</p>
        </div>
      </div>

      <div className="rail mt-4">
        {summary.hourly.slice(0, 12).map((hour) => (
          <article
            key={hour.time}
            className="w-[6.5rem] shrink-0 surface-tile p-3 text-center"
            aria-label={`${formatHour(hour.time, summary.location.timezone)} ${hour.conditionLabel}`}
          >
            <p className="text-sm font-bold text-white">{formatHour(hour.time, summary.location.timezone)}</p>
            <WeatherIcon name={hour.conditionIcon} className="accent-text mx-auto mt-2 size-6" />
            <p className="mt-2 min-h-8 text-xs font-semibold text-white/70">{hour.conditionLabel}</p>
            <div className="mt-2 space-y-1.5 text-xs text-white/72">
              <p className="flex items-center justify-between gap-2">
                <Droplets aria-hidden="true" className="size-3.5 text-cyan-200" />
                <span>{percent(hour.precipitationProbability)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <Gauge aria-hidden="true" className="size-3.5 text-slate-200" />
                <span>{percent(hour.cloudCover)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <SunMedium aria-hidden="true" className="size-3.5 text-amber-200" />
                <span>{hour.isDay === false ? 'night' : hour.uvIndex ?? '—'}</span>
              </p>
              <p className="text-white/48">Humidity {percent(hour.humidity)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
