import { CloudRain, Umbrella } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';
import { formatHour } from '../lib/date';
import { precipitationLabel } from '../lib/weather/summaries';
import { hasWetSignal } from '../lib/weather/summaries';
import { inches, percent } from '../lib/weather/units';

type PrecipitationPanelProps = {
  summary: SunnyDaySummary;
};

export function PrecipitationPanel({ summary }: PrecipitationPanelProps) {
  const next48 = summary.hourly.slice(0, 48);
  const firstLikely = next48.find((hour) => hasWetSignal(hour) || (hour.precipitationInches ?? 0) > 0.04);
  const peak = next48.reduce((best, hour) => {
    const hourScore = (hour.precipitationProbability ?? 0) + (hasWetSignal(hour) ? 50 : 0);
    const bestScore = (best.precipitationProbability ?? 0) + (hasWetSignal(best) ? 50 : 0);
    return hourScore > bestScore ? hour : best;
  }, next48[0]);
  const total = next48.reduce((sum, hour) => sum + (hour.precipitationInches ?? 0), 0);

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-100">
          <CloudRain aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="panel-title">Precipitation</h2>
          <p className="subtle mt-1 text-sm">Next 48 hour signal</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/7 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Peak</p>
          <p className="mt-1 text-2xl font-black text-white">{percent(peak?.precipitationProbability ?? null)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/7 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Amount</p>
          <p className="mt-1 text-2xl font-black text-white">{inches(total, 2)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/7 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/44">Mode</p>
          <p className="mt-1 text-lg font-black text-white">
            {hasWetSignal(peak) ? peak.conditionLabel : precipitationLabel(peak?.precipitationProbability ?? null, total)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/14 bg-white/10 p-3 text-sm text-white/76">
        <div className="flex items-start gap-3">
          <Umbrella aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-200" />
          <p>
            {firstLikely
              ? `First wet-weather signal around ${formatHour(firstLikely.time, summary.location.timezone)}.`
              : 'No likely rain window in the next 48 hours.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-12 items-end gap-1" aria-hidden="true">
        {summary.hourly.slice(0, 24).map((hour) => (
          <div key={hour.time} className="flex h-14 items-end rounded bg-white/10">
            <div
              className="w-full rounded bg-gradient-to-t from-cyan-300 to-amber-200"
              style={{ height: `${Math.max(4, hour.precipitationProbability ?? 0)}%` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
