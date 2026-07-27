import type { LucideIcon } from 'lucide-react';

type MetricChipProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'aqua' | 'amber' | 'rose' | 'neutral';
};

const toneClass = {
  aqua: 'border-cyan-100/30 bg-cyan-100/18 text-cyan-50',
  amber: 'border-amber-100/30 bg-amber-100/20 text-amber-50',
  rose: 'border-rose-100/35 bg-rose-100/20 text-rose-50',
  neutral: 'border-white/22 bg-white/14 text-slate-50',
};

export function MetricChip({ icon: Icon, label, value, tone = 'neutral' }: MetricChipProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 ${toneClass[tone]}`}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <div className="min-w-0">
        <p className="truncate label-caps">{label}</p>
        <p className="truncate text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}
