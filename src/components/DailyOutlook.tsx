import { motion } from 'framer-motion';
import { Droplets } from 'lucide-react';
import { useId } from 'react';
import type { DailySunnyData, SunnyDaySummary } from '../types/weather';
import { bentoContainer, usePrefersReducedMotion } from '../lib/motion';
import { percent, temp } from '../lib/weather/units';
import { WeatherIcon } from './WeatherIcon';
import { Tile } from './bento/Tile';
import { GaugeArc } from './charts/GaugeArc';

type DailyOutlookProps = {
  summary: SunnyDaySummary;
};

const sunshinePercent = (day: DailySunnyData) =>
  day.sunshineDurationSeconds && day.daylightDurationSeconds
    ? Math.round((day.sunshineDurationSeconds / day.daylightDurationSeconds) * 100)
    : null;

const weekday = (date: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(new Date(`${date}T12:00:00`));

const dayNumber = (date: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(new Date(`${date}T12:00:00`));

const chartPoints = (values: Array<number | null>, low: number, high: number) => {
  const span = high - low || 1;
  return values.map((value, index) => ({
    x: 4 + (index / Math.max(1, values.length - 1)) * 92,
    y: 7 + (1 - ((value ?? low) - low) / span) * 48,
  }));
};

const pathThrough = (points: Array<{ x: number; y: number }>) =>
  points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

/**
 * High/low temperature range. The shaded ribbon communicates the overnight
 * spread while the two animated lines preserve the actual daily values.
 */
function TemperatureRangeChart({ days, timeZone }: { days: DailySunnyData[]; timeZone?: string }) {
  const reduced = usePrefersReducedMotion();
  const gradientId = useId();
  const highs = days.map((day) => day.temperatureMaxF);
  const lows = days.map((day) => day.temperatureMinF);
  const present = [...highs, ...lows].filter((value): value is number => value !== null);
  if (present.length < 2) return null;

  const chartLow = Math.floor(Math.min(...present) - 3);
  const chartHigh = Math.ceil(Math.max(...present) + 3);
  const highPoints = chartPoints(highs, chartLow, chartHigh);
  const lowPoints = chartPoints(lows, chartLow, chartHigh);
  const highPath = pathThrough(highPoints);
  const lowPath = pathThrough(lowPoints);
  const bandPath = `${highPath} ${[...lowPoints]
    .reverse()
    .map((point) => `L ${point.x} ${point.y}`)
    .join(' ')} Z`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <svg
        viewBox="0 0 100 62"
        preserveAspectRatio="none"
        className="min-h-0 flex-1 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--heat-2)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--rain-2)" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {[16, 31, 46].map((y) => (
          <line key={y} x1="4" x2="96" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        ))}

        <motion.path
          d={bandPath}
          fill={`url(#${gradientId})`}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        />
        <motion.path
          d={highPath}
          fill="none"
          stroke="var(--heat-2)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.path
          d={lowPath}
          fill="none"
          stroke="var(--rain-2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        />
        {highPoints.map((point, index) => (
          <motion.circle
            key={days[index].date}
            cx={point.x}
            cy={point.y}
            r="1.35"
            fill="var(--heat-2)"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="0.45"
            vectorEffect="non-scaling-stroke"
            initial={reduced ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.08 + index * 0.035, duration: 0.25 }}
          />
        ))}
      </svg>

      <div className="grid grid-cols-7 text-center text-[0.625rem] font-bold uppercase tracking-[0.08em] text-white/38">
        {days.map((day) => (
          <span key={day.date}>{weekday(day.date, timeZone)}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Seven animated bars for a bounded daily metric.
 */
function WeekBars({
  days,
  values,
  colour,
  suffix,
  timeZone,
}: {
  days: DailySunnyData[];
  values: Array<number | null>;
  colour: string;
  suffix: string;
  timeZone?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5">
      {days.map((day, index) => {
        const value = values[index];
        const ratio = Math.max(0.035, Math.min(1, (value ?? 0) / 100));
        return (
          <div key={day.date} className="flex min-w-0 flex-col items-center">
            <span className="mb-1 text-[0.625rem] font-black tabular-nums text-white/62">
              {value === null ? '—' : `${Math.round(value)}${suffix}`}
            </span>
            <div className="flex min-h-0 w-full flex-1 items-end overflow-hidden rounded-md bg-white/7">
              <motion.span
                className="block h-full w-full rounded-md"
                style={{ background: colour, transformOrigin: 'bottom' }}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: ratio }}
                transition={{ delay: index * 0.035, duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="mt-1 text-[0.6rem] font-bold uppercase text-white/34">
              {weekday(day.date, timeZone).slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Outlook mirrors Today's chart-first hierarchy instead of rendering seven
 * miniature weather cards: one temperature feature, three supporting
 * charts, and a compact condition rail.
 */
export function DailyOutlook({ summary }: DailyOutlookProps) {
  const days = summary.daily.slice(0, 7);
  if (!days.length) return null;

  const highs = days.map((day) => day.temperatureMaxF).filter((value): value is number => value !== null);
  const lows = days.map((day) => day.temperatureMinF).filter((value): value is number => value !== null);
  const rain = days.map((day) => day.precipitationProbabilityMax);
  const sunshine = days.map(sunshinePercent);
  const uv = days.map((day) => day.uvIndexMax).filter((value): value is number => value !== null);
  const peakHigh = highs.length ? Math.max(...highs) : null;
  const coolestLow = lows.length ? Math.min(...lows) : null;
  const peakUv = uv.length ? Math.max(...uv) : null;

  return (
    <motion.section
      variants={bentoContainer}
      initial="hidden"
      animate="show"
      className="outlook-bento grid h-full min-h-0 auto-rows-fr grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-6"
      aria-label="Seven day outlook"
    >
      <Tile
        label="Temperature range"
        glow="rgba(251, 146, 60, 0.2)"
        feature
        className="col-span-2 row-span-2 md:col-span-3"
      >
        <div className="mb-2 flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-1.5">
            <span className="tile-figure" style={{ color: 'var(--heat-2)' }}>
              {temp(peakHigh)}
            </span>
            <span className="text-[0.6875rem] font-bold text-white/42">weekly high</span>
          </p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-[var(--rain-2)]">{temp(coolestLow)}</span>
            <span className="hidden text-[0.6875rem] font-bold text-white/42 sm:inline">coolest low</span>
          </p>
        </div>
        <TemperatureRangeChart days={days} timeZone={summary.location.timezone} />
        <div className="mt-1 flex gap-3 text-[0.625rem] font-bold text-white/38">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--heat-2)]" /> High
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--rain-2)]" /> Low
          </span>
        </div>
      </Tile>

      <Tile label="Rain outlook" glow="rgba(56, 189, 248, 0.2)" className="col-span-2 md:col-span-3">
        <WeekBars
          days={days}
          values={rain}
          colour="linear-gradient(180deg, var(--rain-2), var(--rain-1))"
          suffix="%"
          timeZone={summary.location.timezone}
        />
      </Tile>

      <Tile label="Sunshine" glow="rgba(251, 191, 36, 0.2)" className="col-span-1 md:col-span-2">
        <WeekBars
          days={days}
          values={sunshine}
          colour="linear-gradient(180deg, var(--sun-2), var(--sun-1))"
          suffix="%"
          timeZone={summary.location.timezone}
        />
      </Tile>

      <Tile label="Peak UV" glow="rgba(245, 158, 11, 0.2)" className="col-span-1 items-center">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <GaugeArc value={peakUv} max={12} from="var(--uv-1)" to="var(--uv-2)" caption="this week" size={88} decimals={1} />
        </div>
      </Tile>

      <Tile label="Day by day" glow="rgba(148, 163, 184, 0.18)" className="col-span-2 md:col-span-6">
        <div className="outlook-day-grid grid min-h-0 flex-1 grid-cols-7">
          {days.map((day, index) => {
            const selected = day.date === summary.selectedDate;
            return (
              <motion.div
                key={day.date}
                className={`flex min-w-0 flex-col items-center justify-center border-l border-white/8 px-1 text-center first:border-l-0 ${
                  selected ? 'rounded-xl bg-white/9' : ''
                }`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025, duration: 0.28 }}
              >
                <p className="text-[0.625rem] font-black uppercase tracking-[0.08em] text-white/44">
                  {weekday(day.date, summary.location.timezone)} {dayNumber(day.date, summary.location.timezone)}
                </p>
                <WeatherIcon name={day.conditionIcon} className="accent-text my-1 size-5 sm:size-6" />
                <p className="max-w-full truncate text-[0.625rem] font-bold text-white/68">{day.conditionLabel}</p>
                <p className="mt-0.5 text-xs font-black tabular-nums text-white">
                  {temp(day.temperatureMaxF)}
                  <span className="font-bold text-white/34"> / {temp(day.temperatureMinF)}</span>
                </p>
                <p className="outlook-day-rain mt-0.5 hidden items-center gap-1 text-[0.6rem] font-bold text-[var(--rain-2)] sm:flex">
                  <Droplets aria-hidden="true" className="size-2.5" />
                  {percent(day.precipitationProbabilityMax)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </Tile>
    </motion.section>
  );
}
