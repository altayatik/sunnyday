import { CloudSun, Sunrise, Sunset } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';
import { formatClock, formatDurationHours } from '../lib/date';
import { sunshineQuality } from '../lib/weather/summaries';
import { percent } from '../lib/weather/units';

type CloudSunPanelProps = {
  summary: SunnyDaySummary;
};

export function CloudSunPanel({ summary }: CloudSunPanelProps) {
  const current = summary.current;
  const today = summary.daily[0];

  return (
    <section className="surface-panel @container p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="accent-text surface-accent grid size-10 shrink-0 place-items-center">
          <CloudSun aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="panel-title">Cloud & Sun</h2>
          <p className="panel-caption">{sunshineQuality(today, current.cloudCover)} sunshine quality</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 @2xs:grid-cols-3">
        {[
          ['Low', current.lowCloudCover],
          ['Mid', current.midCloudCover],
          ['High', current.highCloudCover],
        ].map(([label, value]) => (
          <div key={label as string} className="surface-inset p-4">
            <p className="label-caps">{label as string} Clouds</p>
            <p className="figure mt-1.5">{percent(value as number | null)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {summary.hourly.slice(0, 8).map((hour) => (
          <div key={hour.time} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3 text-xs text-white/58">
            <span>{formatClock(hour.time, summary.location.timezone)}</span>
            <div className="h-2 overflow-hidden rounded-full bg-white/9">
              <div className="accent-bar h-full rounded-full" style={{ width: `${hour.cloudCover ?? 0}%` }} />
            </div>
            <span className="text-right">{percent(hour.cloudCover)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 @2xs:grid-cols-3">
        <div className="flex items-center gap-3 surface-inset p-3">
          <Sunrise aria-hidden="true" className="size-4 text-amber-200" />
          <span className="text-sm text-white/68">{formatClock(today?.sunrise ?? null, summary.location.timezone)}</span>
        </div>
        <div className="flex items-center gap-3 surface-inset p-3">
          <Sunset aria-hidden="true" className="size-4 text-rose-200" />
          <span className="text-sm text-white/68">{formatClock(today?.sunset ?? null, summary.location.timezone)}</span>
        </div>
        <div className="surface-inset p-3 text-sm text-white/68">
          Sunshine {formatDurationHours(today?.sunshineDurationSeconds ?? null)}
        </div>
      </div>
    </section>
  );
}
