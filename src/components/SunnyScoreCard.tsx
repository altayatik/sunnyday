import { Sparkles } from 'lucide-react';
import type { SunnyDaySummary } from '../types/weather';

type SunnyScoreCardProps = {
  summary: SunnyDaySummary;
};

/**
 * The narrative read.
 *
 * The headline names the single dominant reason; the paragraph is the
 * connected explanation. They are visually separated because burying the most
 * important sentence mid-paragraph was most of why this page felt muddled.
 */
export function SunnyScoreCard({ summary }: SunnyScoreCardProps) {
  const { insights } = summary;

  return (
    <section className="surface-panel flex flex-col p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="accent-text size-4" />
        <h2 className="panel-title">The read</h2>
      </div>

      <p className="mt-3 text-[1.0625rem] font-bold leading-7 text-white">{insights.headline}</p>

      <div className="mt-4 border-t border-white/12 pt-3.5">
        <p className="text-[0.8125rem] leading-6 text-white/70">{insights.paragraph}</p>
      </div>
    </section>
  );
}
