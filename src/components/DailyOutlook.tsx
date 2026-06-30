import { Droplets, SunMedium } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';
import { formatShortDay } from '../lib/date';
import { inches, percent, temp } from '../lib/weather/units';
import { WeatherIcon } from './WeatherIcon';

type DailyOutlookProps = {
  summary: SunnyDaySummary;
};

export function DailyOutlook({ summary }: DailyOutlookProps) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div>
        <h2 className="panel-title">Daily Outlook</h2>
        <p className="subtle mt-1 text-sm">Seven day outside-day hints.</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {summary.daily.slice(0, 7).map((day) => {
          const sunshineRatio =
            day.sunshineDurationSeconds && day.daylightDurationSeconds
              ? Math.round((day.sunshineDurationSeconds / day.daylightDurationSeconds) * 100)
              : null;

          return (
            <article key={day.date} className="rounded-xl border border-white/14 bg-white/12 p-3">
              <p className="text-sm font-black text-white">{formatShortDay(day.date, summary.location.timezone)}</p>
              <WeatherIcon name={day.conditionIcon} className="mt-3 size-6 text-amber-100" />
              <p className="mt-2 min-h-10 text-sm font-semibold text-white/70">{day.conditionLabel}</p>
              <div className="mt-4 space-y-2 text-sm text-white/62">
                <p className="flex items-center justify-between gap-2">
                  <Droplets aria-hidden="true" className="size-4 text-cyan-200" />
                  <span>{percent(day.precipitationProbabilityMax)}</span>
                </p>
                <p className="text-xs text-white/46">{inches(day.precipitationSumInches)} rain</p>
                <p className="flex items-center justify-between gap-2">
                  <SunMedium aria-hidden="true" className="size-4 text-amber-200" />
                  <span>{day.uvIndexMax ?? '—'}</span>
                </p>
                <p className="text-xs text-white/46">
                  {sunshineRatio === null ? 'Sun unclear' : `${sunshineRatio}% sunshine`}
                </p>
              </div>
              <p className="mt-4 text-xs font-semibold text-white/46">
                {temp(day.temperatureMaxF)} / {temp(day.temperatureMinF)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
