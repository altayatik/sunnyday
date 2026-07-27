import { motion } from 'framer-motion';
import { useId } from 'react';
import { useCountUp, usePrefersReducedMotion } from '../../lib/motion';

type GaugeArcProps = {
  value: number | null;
  max: number;
  from: string;
  to: string;
  /** Short unit or band name shown under the figure. */
  caption?: string;
  size?: number;
  decimals?: number;
};

const START_ANGLE = 150;
const SWEEP = 240;
const STROKE = 9;

const polar = (cx: number, cy: number, radius: number, degrees: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
};

const arcPath = (cx: number, cy: number, radius: number, fromDeg: number, toDeg: number) => {
  const start = polar(cx, cy, radius, fromDeg);
  const end = polar(cx, cy, radius, toDeg);
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

/** Small 240° gauge for bounded single values like UV and AQI. */
export function GaugeArc({ value, max, from, to, caption, size = 96, decimals = 0 }: GaugeArcProps) {
  const reduced = usePrefersReducedMotion();
  const safe = value ?? 0;
  const animated = useCountUp(safe, { enabled: !reduced, duration: 550 });
  const shown = reduced ? safe : animated;

  const gradientId = useId();
  const centre = size / 2;
  const radius = centre - STROKE;
  const ratio = Math.max(0, Math.min(1, safe / max));

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <path
          d={arcPath(centre, centre, radius, START_ANGLE, START_ANGLE + SWEEP)}
          fill="none"
          stroke="rgba(6, 22, 32, 0.32)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <motion.path
          d={arcPath(centre, centre, radius, START_ANGLE, START_ANGLE + Math.max(0.01, SWEEP * ratio))}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xl font-black leading-none tabular-nums text-white">
            {value === null ? '—' : shown.toFixed(decimals)}
          </p>
          {caption ? <p className="mt-0.5 text-[0.625rem] font-bold text-white/48">{caption}</p> : null}
        </div>
      </div>
    </div>
  );
}
