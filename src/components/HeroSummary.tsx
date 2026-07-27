import { motion } from 'framer-motion';
import type { SunnyDaySummary } from '../types/weather';
import { temp } from '../lib/weather/units';
import { WeatherIcon } from './WeatherIcon';
import { formatShortDay } from '../lib/date';
import { springy } from '../lib/motion';

type HeroSummaryProps = {
  summary: SunnyDaySummary;
};

const locationLabel = (summary: SunnyDaySummary) =>
  [summary.location.name, summary.location.admin1].filter(Boolean).join(', ');

/**
 * A compact identity bar, not a hero panel.
 *
 * This used to be a full-height card carrying the score, the confidence, seven
 * model chips, six metric chips, and a paragraph - roughly a third of a screen
 * before any actual content. All of that now lives in the bento tiles where it
 * can be a chart instead of a number with a label, so the top of the page just
 * answers "where, when, what's it doing" and gets out of the way.
 */
export function HeroSummary({ summary }: HeroSummaryProps) {
  const current = summary.current;
  const confidence = summary.accuracy;

  return (
    <motion.section
      className="hero-summary flex flex-wrap items-center justify-between gap-x-5 gap-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springy}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <motion.span
          className="accent-text grid size-12 shrink-0 place-items-center rounded-2xl border border-white/22 bg-white/14 shadow-lg shadow-black/10"
          initial={{ scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...springy, delay: 0.05 }}
        >
          <WeatherIcon name={current.conditionIcon} className="size-7" />
        </motion.span>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black leading-tight tracking-[-0.02em] text-white sm:text-[1.75rem]">
            {locationLabel(summary)}
          </h1>
          <p className="mt-0.5 truncate text-[0.8125rem] font-semibold text-white/58">
            {formatShortDay(summary.selectedDate, summary.location.timezone)} · {current.conditionLabel} ·{' '}
            {temp(current.temperatureF)}
          </p>
        </div>
      </div>

      {confidence && confidence.coveredCount >= 2 ? (
        <motion.div
          className="model-confidence flex items-center gap-2.5 rounded-full border border-white/16 bg-white/10 py-1.5 pl-3 pr-3.5"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springy, delay: 0.12 }}
        >
          <span className="flex items-center gap-1.5">
            {/* Coverage as dots rather than "5/7 models" - readable without
                parsing, and it makes a missing model visible at a glance. */}
            {confidence.sources.map((source) => (
              <span
                key={source.id}
                title={`${source.label}${source.covered ? ` · ${source.score}` : ' · no data'}`}
                className={`size-1.5 rounded-full ${source.covered ? 'bg-emerald-300' : 'bg-white/22'}`}
              />
            ))}
          </span>
          <span className="text-[0.6875rem] font-black uppercase tracking-[0.12em] text-white/62">
            {confidence.label} · {confidence.score}
          </span>
        </motion.div>
      ) : null}
    </motion.section>
  );
}
