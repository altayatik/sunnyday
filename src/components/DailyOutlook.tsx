import { motion } from 'framer-motion';
import { Droplets, SunMedium, ThermometerSun } from 'lucide-react';
import type { DailySunnyData, SunnyDaySummary } from '../types/weather';
import { formatShortDay } from '../lib/date';
import { bentoContainer, bentoItem } from '../lib/motion';
import { inches, percent, temp } from '../lib/weather/units';
import { WeatherIcon } from './WeatherIcon';
import { Tile } from './bento/Tile';

type DailyOutlookProps = {
  summary: SunnyDaySummary;
};

const sunshinePercent = (day: DailySunnyData) =>
  day.sunshineDurationSeconds && day.daylightDurationSeconds
    ? Math.round((day.sunshineDurationSeconds / day.daylightDurationSeconds) * 100)
    : null;

const weatherGlow = (day: DailySunnyData) => {
  const rain = day.precipitationProbabilityMax ?? 0;
  const sunshine = sunshinePercent(day) ?? 0;
  if (rain >= 50) return 'rgba(56, 189, 248, 0.24)';
  if (sunshine >= 70) return 'rgba(251, 191, 36, 0.22)';
  return 'rgba(148, 163, 184, 0.2)';
};

const DayMeter = ({
  icon,
  label,
  value,
  width,
  colour,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  width: number;
  colour: string;
}) => (
  <div>
    <div className="flex items-center justify-between gap-2 text-[0.6875rem] font-bold text-white/52">
      <span className="flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="tabular-nums text-white/76">{value}</span>
    </div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, width)}%`, background: colour }} />
    </div>
  </div>
);

/**
 * Seven-day forecast using the same visual hierarchy as Today: the selected
 * day is the feature tile, while the other six are compact small multiples.
 * The fixed grid deliberately fits the available viewport rather than
 * turning the forecast into a vertical list.
 */
export function DailyOutlook({ summary }: DailyOutlookProps) {
  const days = summary.daily.slice(0, 7);
  const selected = days.find((day) => day.date === summary.selectedDate) ?? days[0];
  if (!selected) return null;

  const otherDays = days.filter((day) => day.date !== selected.date);
  const selectedSunshine = sunshinePercent(selected);
  const selectedRain = selected.precipitationProbabilityMax ?? 0;

  return (
    <motion.section
      variants={bentoContainer}
      initial="hidden"
      animate="show"
      className="grid h-full min-h-0 auto-rows-fr grid-cols-4 gap-2 sm:gap-2.5 xl:grid-cols-5"
      aria-label="Seven day outlook"
    >
      <Tile
        label="Selected day"
        glow={weatherGlow(selected)}
        feature
        className="col-span-2 row-span-2 justify-between"
      >
        <div className="flex min-h-0 flex-1 flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.08em] text-white/58">
                {formatShortDay(selected.date, summary.location.timezone)}
              </p>
              <p className="mt-1 truncate text-xl font-black text-white sm:text-2xl">{selected.conditionLabel}</p>
            </div>
            <WeatherIcon name={selected.conditionIcon} className="accent-text size-10 shrink-0 sm:size-12" />
          </div>

          <div className="my-2 flex items-end gap-2">
            <span className="text-4xl font-black leading-none tracking-[-0.04em] text-white sm:text-5xl">
              {temp(selected.temperatureMaxF)}
            </span>
            <span className="pb-1 text-base font-bold text-white/42">/ {temp(selected.temperatureMinF)}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <DayMeter
              icon={<Droplets aria-hidden="true" className="size-3.5 text-[var(--rain-2)]" />}
              label="Rain"
              value={percent(selected.precipitationProbabilityMax)}
              width={selectedRain}
              colour="linear-gradient(90deg, var(--rain-1), var(--rain-2))"
            />
            <DayMeter
              icon={<SunMedium aria-hidden="true" className="size-3.5 text-[var(--sun-2)]" />}
              label="Sun"
              value={selectedSunshine === null ? '—' : `${selectedSunshine}%`}
              width={selectedSunshine ?? 0}
              colour="linear-gradient(90deg, var(--sun-1), var(--sun-2))"
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[0.6875rem] font-bold text-white/44">
            <span>{inches(selected.precipitationSumInches)} total rain</span>
            <span>UV {selected.uvIndexMax ?? '—'}</span>
          </div>
        </div>
      </Tile>

      {otherDays.map((day) => {
        const sunshine = sunshinePercent(day);
        const rain = day.precipitationProbabilityMax ?? 0;

        return (
          <motion.article
            key={day.date}
            variants={bentoItem}
            className="bento min-h-0 p-2.5 sm:p-3"
            style={{ '--tile-glow': weatherGlow(day) } as React.CSSProperties}
          >
            <div className="flex items-start justify-between gap-1.5">
              <p className="truncate text-[0.6875rem] font-black uppercase tracking-[0.08em] text-white/58 sm:text-xs">
                {formatShortDay(day.date, summary.location.timezone)}
              </p>
              <WeatherIcon name={day.conditionIcon} className="accent-text size-5 shrink-0 sm:size-6" />
            </div>

            <div className="my-auto min-h-0 py-1">
              <p className="truncate text-sm font-black text-white sm:text-base">{day.conditionLabel}</p>
              <p className="mt-1 flex items-baseline gap-1 text-white">
                <span className="text-xl font-black leading-none tracking-[-0.03em] sm:text-2xl">
                  {temp(day.temperatureMaxF)}
                </span>
                <span className="text-[0.6875rem] font-bold text-white/40">/ {temp(day.temperatureMinF)}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <DayMeter
                icon={<Droplets aria-hidden="true" className="size-3 text-[var(--rain-2)]" />}
                label="Rain"
                value={percent(day.precipitationProbabilityMax)}
                width={rain}
                colour="var(--rain-2)"
              />
              <DayMeter
                icon={<SunMedium aria-hidden="true" className="size-3 text-[var(--sun-2)]" />}
                label="Sun"
                value={sunshine === null ? '—' : `${sunshine}%`}
                width={sunshine ?? 0}
                colour="var(--sun-2)"
              />
            </div>

            <div className="mt-2 hidden items-center justify-between text-[0.625rem] font-bold text-white/38 sm:flex">
              <span className="flex items-center gap-1">
                <ThermometerSun aria-hidden="true" className="size-3" />
                UV {day.uvIndexMax ?? '—'}
              </span>
              <span>{inches(day.precipitationSumInches)}</span>
            </div>
          </motion.article>
        );
      })}
    </motion.section>
  );
}
