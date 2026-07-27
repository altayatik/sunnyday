import { Circle, CloudSun, RadioTower, Satellite, Waypoints, Wind } from 'lucide-react';
import type { SunnyDaySources } from '../types/weather';

type SourceStatusProps = {
  sources: SunnyDaySources;
};

const statusText = {
  ok: 'ok',
  error: 'error',
  unavailable: 'off',
  loading: 'sync',
};

const statusClass = {
  ok: 'text-emerald-300',
  error: 'text-rose-300',
  unavailable: 'text-slate-400',
  loading: 'text-amber-200',
};

export function SourceStatus({ sources }: SourceStatusProps) {
  const items = [
    { label: 'Open-Meteo', value: sources.openMeteo, icon: CloudSun },
    { label: '7 Models', value: sources.models, icon: Waypoints },
    { label: 'Air quality', value: sources.airQuality, icon: Wind },
    { label: 'RainViewer', value: sources.rainViewer, icon: Satellite },
    { label: 'NWS', value: sources.nws, icon: RadioTower },
  ];

  return (
    <div className="source-status flex flex-wrap items-center gap-2 text-xs text-white/72" aria-label="Data source status">
      {items.map(({ label, value, icon: Icon }) => (
        <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-white/14 px-2.5 py-1">
          <Icon aria-hidden="true" className="size-3.5" />
          <span>{label}</span>
          <Circle aria-hidden="true" className={`size-2 fill-current ${statusClass[value]}`} />
          <span className={statusClass[value]}>{statusText[value]}</span>
        </span>
      ))}
    </div>
  );
}
