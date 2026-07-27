import { CheckCircle2, MinusCircle } from 'lucide-react';
import type { InsightFactor, SunnyDaySummary } from '../types/weather';

type ScoreFactorsPanelProps = {
  summary: SunnyDaySummary;
};

const toneClass: Record<InsightFactor['tone'], string> = {
  sun: 'text-amber-100',
  rain: 'text-sky-100',
  cloud: 'text-slate-100',
  comfort: 'text-orange-100',
  uv: 'text-yellow-100',
  wind: 'text-teal-100',
  air: 'text-lime-100',
  alert: 'text-rose-100',
  neutral: 'text-white/80',
};

function FactorColumn({ factors, positive }: { factors: InsightFactor[]; positive: boolean }) {
  return (
    <div>
      <h3 className="label-caps flex items-center gap-1.5">
        {positive ? (
          <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-200" />
        ) : (
          <MinusCircle aria-hidden="true" className="size-3.5 text-rose-200" />
        )}
        {positive ? 'In your favour' : 'Holding it back'}
      </h3>

      {factors.length ? (
        <ul className="mt-2 grid gap-1.5">
          {factors.slice(0, 4).map((factor) => (
            <li key={factor.id} className="surface-tile px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[0.8125rem] font-bold ${toneClass[factor.tone]}`}>{factor.title}</span>
                {!positive && factor.points > 0 ? (
                  <span className="shrink-0 text-[0.6875rem] font-black tabular-nums text-white/44">
                    −{Math.round(factor.points)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[0.75rem] leading-[1.35rem] text-white/62">{factor.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[0.8125rem] text-white/48">
          {positive ? 'Nothing is actively helping today.' : 'Nothing is dragging the score down.'}
        </p>
      )}
    </div>
  );
}

/** The ranked drivers behind the score, worst-first. */
export function ScoreFactorsPanel({ summary }: ScoreFactorsPanelProps) {
  const { negatives, positives } = summary.insights;

  return (
    <section className="surface-panel @container p-4 sm:p-5">
      <div>
        <h2 className="panel-title">What's driving it</h2>
        <p className="panel-caption">Ranked by points cost, not by check order.</p>
      </div>

      <div className="mt-4 grid gap-4 @md:grid-cols-2">
        <FactorColumn factors={negatives} positive={false} />
        <FactorColumn factors={positives} positive />
      </div>
    </section>
  );
}
