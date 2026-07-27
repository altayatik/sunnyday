import { CalendarClock, Clock, Lightbulb } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';
import { formatHour, formatShortDay } from '../lib/date';

type BestWindowPanelProps = {
  summary: SunnyDaySummary;
};

/**
 * The actionable half of the insight: when to go out, whether another day is
 * better, and what to bring. Split out of the old breakdown monolith so it can
 * sit beside the category bars instead of below them.
 */
export function BestWindowPanel({ summary }: BestWindowPanelProps) {
  const { insights } = summary;
  const timeZone = summary.location.timezone;
  const { bestWindow, betterDay, recommendations } = insights;

  return (
    <section className="surface-panel flex flex-col p-4 sm:p-5">
      <div>
        <h2 className="panel-title">When to go out</h2>
        <p className="panel-caption">Best stretch in the selected day.</p>
      </div>

      {bestWindow ? (
        <div className="surface-accent mt-4 p-3.5">
          <p className="label-caps accent-text flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-3.5" />
            {bestWindow.label}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xl font-black leading-none text-white">
              {formatHour(bestWindow.startTime, timeZone)} – {formatHour(bestWindow.endTime, timeZone)}
            </span>
            <span className="text-[0.8125rem] font-bold text-white/56">
              {bestWindow.hours}h · {bestWindow.score}/100
            </span>
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-5 text-white/68">{bestWindow.detail}</p>
        </div>
      ) : (
        <p className="surface-inset mt-4 p-3.5 text-[0.8125rem] text-white/64">
          No daylight hours left in the selected day to rank.
        </p>
      )}

      {betterDay ? (
        <div className="surface-inset mt-3 flex items-start gap-2.5 p-3.5">
          <CalendarClock aria-hidden="true" className="accent-text mt-0.5 size-4 shrink-0" />
          <p className="text-[0.8125rem] leading-5 text-white/78">
            <span className="font-bold text-white">{formatShortDay(betterDay.date, timeZone)}</span> currently looks
            materially better, tracking near {betterDay.score}/100.
          </p>
        </div>
      ) : null}

      {recommendations.length ? (
        <div className="mt-4 flex-1">
          <h3 className="label-caps flex items-center gap-1.5">
            <Lightbulb aria-hidden="true" className="accent-text size-3.5" />
            What to do about it
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {recommendations.map((recommendation) => (
              <li key={recommendation} className="flex gap-2 text-[0.8125rem] leading-5 text-white/76">
                <span aria-hidden="true" className="accent-text mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
                {recommendation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
