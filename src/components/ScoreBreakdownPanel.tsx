import { motion } from 'framer-motion';
import type { ScoreBreakdown, SunnyDaySummary } from '../types/weather';

type ScoreBreakdownPanelProps = {
  summary: SunnyDaySummary;
};

const categories: Array<{ key: keyof ScoreBreakdown; label: string; weight: string }> = [
  { key: 'precipitation', label: 'Precipitation', weight: '32%' },
  { key: 'sky', label: 'Sky', weight: '22%' },
  { key: 'comfort', label: 'Comfort', weight: '22%' },
  { key: 'safety', label: 'Safety', weight: '14%' },
  { key: 'air', label: 'Air', weight: '10%' },
];

/**
 * Colour by value rather than by the scene accent: here the number's meaning
 * matters more than visual cohesion, and a red bar should read as a problem
 * regardless of what the sky is doing.
 */
const barTone = (value: number) => {
  if (value >= 85) return 'from-emerald-300 to-teal-200';
  if (value >= 65) return 'from-cyan-300 to-emerald-200';
  if (value >= 45) return 'from-amber-300 to-cyan-200';
  return 'from-rose-400 to-amber-300';
};

/** How the score was assembled, as five independently bounded categories. */
export function ScoreBreakdownPanel({ summary }: ScoreBreakdownPanelProps) {
  const { breakdown, accuracy } = summary;

  return (
    <section className="surface-panel flex flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="panel-title">Why this score</h2>
          <p className="panel-caption">Each category is bounded, then weighted.</p>
        </div>
        <span className="figure accent-text">{summary.sunnyDayScore}</span>
      </div>

      <div className="mt-4 grid flex-1 content-start gap-3">
        {categories.map((category) => {
          const value = breakdown[category.key];
          return (
            <div key={category.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.8125rem] font-bold text-white/80">
                  {category.label}
                  <span className="ml-1.5 font-medium text-white/40">{category.weight}</span>
                </span>
                <span className="text-[0.8125rem] font-black tabular-nums text-white/72">{value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/25">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${barTone(value)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {accuracy && accuracy.coveredCount >= 2 ? (
        <p className="mt-4 border-t border-white/10 pt-3 text-[0.8125rem] text-white/58">
          {accuracy.coveredCount} models place it between{' '}
          <span className="font-bold text-white/80">{accuracy.scoreLow}</span> and{' '}
          <span className="font-bold text-white/80">{accuracy.scoreHigh}</span>.
        </p>
      ) : null}
    </section>
  );
}
