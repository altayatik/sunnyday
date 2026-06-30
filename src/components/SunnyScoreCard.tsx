import { Sparkles } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';

type SunnyScoreCardProps = {
  summary: SunnyDaySummary;
};

export function SunnyScoreCard({ summary }: SunnyScoreCardProps) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="panel-title flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-amber-100" />
            AI Insights
          </h2>
          <p className="subtle mt-1 text-sm">A quick outside-day readout.</p>
        </div>
        <span className="rounded-full border border-white/25 bg-white/18 px-3 py-1 text-sm font-black text-white">
          {summary.sunnyDayScore}
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-white/16 bg-white/12 p-4">
        <p className="text-sm leading-7 text-white/82">{summary.aiInsight}</p>
      </div>
    </section>
  );
}
