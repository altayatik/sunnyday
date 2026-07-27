import { Eye, Gauge, SunMedium, ThermometerSun, Wind } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';
import { comfortNotes } from '../lib/weather/summaries';
import { mph, percent, temp } from '../lib/weather/units';

type ComfortPanelProps = {
  summary: SunnyDaySummary;
};

export function ComfortPanel({ summary }: ComfortPanelProps) {
  const current = summary.current;
  const visibilityMiles = current.visibilityMeters === null ? null : current.visibilityMeters / 1609.344;

  return (
    <section className="surface-panel @container p-4 sm:p-5">
      <div>
        <h2 className="panel-title">Comfort</h2>
        <p className="panel-caption">{comfortNotes(current).join(' • ')}</p>
      </div>

      <div className="mt-4 grid gap-2 @2xs:grid-cols-2 @lg:grid-cols-3">
        {[
          { label: 'Feels like', value: temp(current.apparentTemperatureF), icon: ThermometerSun },
          { label: 'Humidity', value: percent(current.humidity), icon: Gauge },
          { label: 'Wind / Gusts', value: `${mph(current.windSpeedMph)} / ${mph(current.windGustMph)}`, icon: Wind },
          { label: 'UV Index', value: current.uvIndex === null ? '—' : String(current.uvIndex), icon: SunMedium },
          { label: 'Visibility', value: visibilityMiles === null ? '—' : `${Math.round(visibilityMiles)} mi`, icon: Eye },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 surface-tile p-3">
            <Icon aria-hidden="true" className="accent-text size-5 shrink-0" />
            <div className="min-w-0">
              <p className="label-caps">{label}</p>
              <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
