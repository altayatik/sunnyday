import { motion } from 'framer-motion';
import { Droplets } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { DailySunnyData, SunnyDaySummary } from '../types/weather';
import { bentoContainer, usePrefersReducedMotion } from '../lib/motion';
import { inches, percent, temp } from '../lib/weather/units';
import { WeatherIcon } from './WeatherIcon';
import { Tile } from './bento/Tile';
import { DetailSheet } from './bento/DetailSheet';
import { GaugeArc } from './charts/GaugeArc';

type DailyOutlookProps = {
  summary: SunnyDaySummary;
  /** Switches the whole app to the chosen day. */
  onSelectDate?: (date: string) => void;
};

type WeekDetailId = 'temperature' | 'rain' | 'sunshine' | 'uv';

const sunshinePercent = (day: DailySunnyData) =>
  day.sunshineDurationSeconds && day.daylightDurationSeconds
    ? Math.round((day.sunshineDurationSeconds / day.daylightDurationSeconds) * 100)
    : null;

const weekday = (date: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(new Date(`${date}T12:00:00`));

const dayNumber = (date: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(new Date(`${date}T12:00:00`));

/**
 * Points sit at the centre of their weekday column.
 *
 * They used to span x=4..96 while the weekday labels underneath were a plain
 * 7-column grid, so every marker was offset from its own label - worse the
 * further from the middle. Sharing the column geometry fixes the alignment by
 * construction instead of by tuning numbers until it looks close.
 */
const columnX = (index: number, count: number) => ((index + 0.5) / count) * 100;

const CHART_HEIGHT = 62;

const chartPoints = (values: Array<number | null>, low: number, high: number) => {
  const span = high - low || 1;
  return values.map((value, index) => ({
    x: columnX(index, values.length),
    y: 6 + (1 - ((value ?? low) - low) / span) * 50,
  }));
};

const pathThrough = (points: Array<{ x: number; y: number }>) =>
  points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

/**
 * High/low temperature range.
 *
 * The markers are HTML, not SVG circles. This chart stretches with
 * `preserveAspectRatio="none"`, which squashes any circle into an ellipse -
 * the dots were visibly oval at wide sizes. Absolutely-positioned elements
 * stay round at every aspect ratio.
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
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 100 ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--heat-2)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--rain-2)" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {[16, 31, 46].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--tile-rule)" strokeWidth="0.5" />
          ))}

          <motion.path
            d={bandPath}
            fill={`url(#${gradientId})`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
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
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
            transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        {highPoints.map((point, index) => (
          <span
            key={days[index].date}
            aria-hidden="true"
            className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--tile-base)] bg-[var(--heat-2)]"
            style={{ left: `${point.x}%`, top: `${(point.y / CHART_HEIGHT) * 100}%` }}
          />
        ))}
      </div>

      <div className="ink-hair mt-1 grid grid-cols-7 text-center text-[0.625rem] font-bold uppercase tracking-[0.08em]">
        {days.map((day) => (
          <span key={day.date}>{weekday(day.date, timeZone)}</span>
        ))}
      </div>
    </div>
  );
}

/** Seven animated bars for a bounded daily metric. */
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
            <span className="ink-soft mb-1 text-[0.625rem] font-black tabular-nums">
              {value === null ? '—' : `${Math.round(value)}${suffix}`}
            </span>
            <div className="tile-track flex min-h-0 w-full flex-1 items-end overflow-hidden rounded-md">
              <motion.span
                className="block h-full w-full rounded-md"
                style={{ background: colour, transformOrigin: 'bottom' }}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: ratio }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="ink-hair mt-1 text-[0.6rem] font-bold uppercase">
              {weekday(day.date, timeZone).slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Seven-row table shared by every week detail sheet. */
function WeekTable({
  days,
  timeZone,
  columns,
}: {
  days: DailySunnyData[];
  timeZone?: string;
  columns: Array<{ header: string; render: (day: DailySunnyData) => string }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-white/6 text-[0.6875rem] font-black uppercase tracking-[0.12em] text-white/50">
            <th className="px-3 py-2">Day</th>
            {columns.map((column) => (
              <th key={column.header} className="px-3 py-2 text-right">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date} className="border-t border-white/8">
              <td className="px-3 py-2 font-bold text-white">
                {weekday(day.date, timeZone)} {dayNumber(day.date, timeZone)}
              </td>
              {columns.map((column) => (
                <td key={column.header} className="px-3 py-2 text-right tabular-nums text-white/76">
                  {column.render(day)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Outlook mirrors Today's chart-first hierarchy. Every summary tile opens the
 * same numbers as a table, and each day in the rail switches the whole app to
 * that day - which is more useful than opening yet another sheet.
 */
export function DailyOutlook({ summary, onSelectDate }: DailyOutlookProps) {
  const [openDetail, setOpenDetail] = useState<WeekDetailId | null>(null);
  const days = summary.daily.slice(0, 7);
  const timeZone = summary.location.timezone;

  if (!days.length) return null;

  const highs = days.map((day) => day.temperatureMaxF).filter((value): value is number => value !== null);
  const lows = days.map((day) => day.temperatureMinF).filter((value): value is number => value !== null);
  const rain = days.map((day) => day.precipitationProbabilityMax);
  const sunshine = days.map(sunshinePercent);
  const uv = days.map((day) => day.uvIndexMax).filter((value): value is number => value !== null);
  const peakHigh = highs.length ? Math.max(...highs) : null;
  const coolestLow = lows.length ? Math.min(...lows) : null;
  const peakUv = uv.length ? Math.max(...uv) : null;

  const opens = (id: WeekDetailId) => ({
    layoutId: `outlook-${id}`,
    onOpen: () => setOpenDetail(id),
    expanded: openDetail === id,
  });

  const details: Record<WeekDetailId, { title: string; accent: string; body: ReactNode }> = {
    temperature: {
      title: 'Temperature this week',
      accent: 'rgba(251, 146, 60, 0.18)',
      body: (
        <WeekTable
          days={days}
          timeZone={timeZone}
          columns={[
            { header: 'High', render: (day) => temp(day.temperatureMaxF) },
            { header: 'Low', render: (day) => temp(day.temperatureMinF) },
            { header: 'Conditions', render: (day) => day.conditionLabel },
          ]}
        />
      ),
    },
    rain: {
      title: 'Rain this week',
      accent: 'rgba(56, 189, 248, 0.18)',
      body: (
        <WeekTable
          days={days}
          timeZone={timeZone}
          columns={[
            { header: 'Chance', render: (day) => percent(day.precipitationProbabilityMax) },
            { header: 'Amount', render: (day) => inches(day.precipitationSumInches) },
          ]}
        />
      ),
    },
    sunshine: {
      title: 'Sunshine this week',
      accent: 'rgba(251, 191, 36, 0.18)',
      body: (
        <WeekTable
          days={days}
          timeZone={timeZone}
          columns={[
            {
              header: 'Sunshine',
              render: (day) => {
                const value = sunshinePercent(day);
                return value === null ? '—' : `${value}%`;
              },
            },
            { header: 'Conditions', render: (day) => day.conditionLabel },
          ]}
        />
      ),
    },
    uv: {
      title: 'UV this week',
      accent: 'rgba(245, 158, 11, 0.18)',
      body: (
        <WeekTable
          days={days}
          timeZone={timeZone}
          columns={[
            { header: 'Peak UV', render: (day) => (day.uvIndexMax === null ? '—' : String(day.uvIndexMax)) },
            { header: 'High', render: (day) => temp(day.temperatureMaxF) },
          ]}
        />
      ),
    },
  };

  const active = openDetail ? details[openDetail] : null;

  return (
    <>
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
          {...opens('temperature')}
        >
          <div className="mb-2 flex items-end justify-between gap-3">
            <p className="flex items-baseline gap-1.5">
              <span className="tile-figure" style={{ color: 'var(--heat-2)' }}>
                {temp(peakHigh)}
              </span>
              <span className="ink-hair text-[0.6875rem] font-bold">weekly high</span>
            </p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-[var(--rain-2)]">{temp(coolestLow)}</span>
              <span className="ink-hair hidden text-[0.6875rem] font-bold sm:inline">coolest low</span>
            </p>
          </div>
          <TemperatureRangeChart days={days} timeZone={timeZone} />
        </Tile>

        <Tile
          label="Rain outlook"
          glow="rgba(56, 189, 248, 0.2)"
          className="col-span-2 md:col-span-3"
          {...opens('rain')}
        >
          <WeekBars
            days={days}
            values={rain}
            colour="linear-gradient(180deg, var(--rain-2), var(--rain-1))"
            suffix="%"
            timeZone={timeZone}
          />
        </Tile>

        <Tile
          label="Sunshine"
          glow="rgba(251, 191, 36, 0.2)"
          className="col-span-1 md:col-span-2"
          {...opens('sunshine')}
        >
          <WeekBars
            days={days}
            values={sunshine}
            colour="linear-gradient(180deg, var(--sun-2), var(--sun-1))"
            suffix="%"
            timeZone={timeZone}
          />
        </Tile>

        <Tile label="Peak UV" glow="rgba(245, 158, 11, 0.2)" className="col-span-1 items-center" {...opens('uv')}>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <GaugeArc value={peakUv} max={12} from="var(--uv-1)" to="var(--uv-2)" caption="this week" size={88} />
          </div>
        </Tile>

        {/* Day rail: each day switches the app to that date. */}
        <section className="bento col-span-2 p-3 sm:p-4 md:col-span-6">
          <p className="tile-label">Day by day</p>
          <div className="mt-2 grid min-h-0 flex-1 grid-cols-7 gap-1">
            {days.map((day) => {
              const selected = day.date === summary.selectedDate;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => onSelectDate?.(day.date)}
                  aria-pressed={selected}
                  aria-label={`Show ${weekday(day.date, timeZone)} ${dayNumber(day.date, timeZone)}`}
                  className={`focus-ring flex min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1 text-center transition ${
                    selected
                      ? 'tile-track ring-1 ring-[var(--tile-border-hover)]'
                      : 'hover:bg-[var(--tile-track)]'
                  }`}
                >
                  <p className="ink-faint text-[0.625rem] font-black uppercase tracking-[0.08em]">
                    {weekday(day.date, timeZone)} {dayNumber(day.date, timeZone)}
                  </p>
                  <WeatherIcon name={day.conditionIcon} className="accent-text my-1 size-5 sm:size-6" />
                  <p className="ink-soft max-w-full truncate text-[0.625rem] font-bold">{day.conditionLabel}</p>
                  <p className="ink mt-0.5 text-xs font-black tabular-nums">
                    {temp(day.temperatureMaxF)}
                    <span className="ink-hair font-bold"> / {temp(day.temperatureMinF)}</span>
                  </p>
                  <p className="outlook-day-rain mt-0.5 hidden items-center gap-1 text-[0.6rem] font-bold text-[var(--rain-2)] sm:flex">
                    <Droplets aria-hidden="true" className="size-2.5" />
                    {percent(day.precipitationProbabilityMax)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </motion.section>

      <DetailSheet
        open={active !== null}
        onClose={() => setOpenDetail(null)}
        title={active?.title ?? ''}
        layoutId={`outlook-${openDetail ?? 'none'}`}
        accent={active?.accent}
      >
        {active?.body ?? null}
      </DetailSheet>
    </>
  );
}
