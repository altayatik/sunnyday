import { BadgeCheck, Cloud, Droplets, SunMedium, ThermometerSun, Umbrella, Wind } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SunnyDaySummary } from '../types/weather';
import { inches, mph, percent, temp } from '../lib/weather/units';
import { MetricChip } from './MetricChip';
import { WeatherIcon } from './WeatherIcon';
import { formatShortDay } from '../lib/date';
import { hasWetSignal } from '../lib/weather/summaries';

type HeroSummaryProps = {
  summary: SunnyDaySummary;
};

const locationLabel = (summary: SunnyDaySummary) =>
  [summary.location.name, summary.location.admin1].filter(Boolean).join(', ');

export function HeroSummary({ summary }: HeroSummaryProps) {
  const current = summary.current;
  const wetSignal = hasWetSignal(current);

  return (
    <motion.section
      className="glass relative overflow-hidden rounded-2xl p-4 sm:p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/60 to-transparent" />
      <div className="absolute right-[-6rem] top-[-6rem] size-72 rounded-full bg-white/18 blur-3xl" />

      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/66">
            {locationLabel(summary)} • {formatShortDay(summary.selectedDate, summary.location.timezone)}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid size-16 place-items-center rounded-2xl border border-white/22 bg-white/18 text-amber-100 shadow-xl shadow-white/10">
              <WeatherIcon name={current.conditionIcon} className="size-9" />
            </div>
            <div className="min-w-0">
              <h1 className="text-4xl font-black leading-none text-white sm:text-5xl">{summary.scoreLabel}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/76 sm:text-base">{summary.summaryText}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[24rem]">
          <div className="rounded-2xl border border-white/22 bg-white/16 p-4 text-left">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/62">SunnyDay Score</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-black leading-none text-white">{summary.sunnyDayScore}</span>
              <span className="pb-1.5 text-lg font-bold text-white/58">/100</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-200 to-amber-200"
                style={{ width: `${summary.sunnyDayScore}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/22 bg-white/12 p-4 text-left">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/62">
              <BadgeCheck aria-hidden="true" className="size-4 text-cyan-100" />
              Accuracy
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-black leading-none text-white">{summary.accuracy?.score ?? '—'}</span>
              <span className="pb-1.5 text-lg font-bold text-white/58">{summary.accuracy ? '/100' : ''}</span>
            </div>
            <p className="mt-3 text-xs font-bold text-white/68">
              {summary.accuracy
                ? `${summary.accuracy.label} agreement • ${summary.accuracy.sourceCount} models`
                : 'Comparing forecast models'}
            </p>
            {summary.accuracy ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {summary.accuracy.sources.map((source) => (
                  <span key={source.id} className="rounded-full bg-white/12 px-2 py-1 text-[0.65rem] font-bold text-white/64">
                    {source.label} {source.score}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MetricChip
          icon={Umbrella}
          label="Rain"
          value={wetSignal ? `${current.conditionLabel} • ${inches(current.precipitationInches)}` : `${percent(current.precipitationProbability)} • ${inches(current.precipitationInches)}`}
          tone={wetSignal || (current.precipitationProbability ?? 0) >= 50 ? 'rose' : 'aqua'}
        />
        <MetricChip icon={Cloud} label="Clouds" value={percent(current.cloudCover)} />
        <MetricChip icon={SunMedium} label="UV" value={current.uvIndex === null ? '—' : String(current.uvIndex)} tone="amber" />
        <MetricChip icon={Droplets} label="Humidity" value={percent(current.humidity)} />
        <MetricChip icon={Wind} label="Wind" value={mph(current.windSpeedMph)} />
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-sm text-white/66">
        <ThermometerSun aria-hidden="true" className="size-4" />
        <span>Temperature is {temp(current.temperatureF)}, feels like {temp(current.apparentTemperatureF)}.</span>
      </div>
    </motion.section>
  );
}
