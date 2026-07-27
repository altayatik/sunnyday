import { motion } from 'framer-motion';
import { useId } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';

type SparklineProps = {
  values: Array<number | null>;
  /** Fixed scale so tiles stay comparable; defaults to the data range. */
  min?: number;
  max?: number;
  from: string;
  to: string;
  height?: number;
  /** Draws a filled area under the line. */
  area?: boolean;
  className?: string;
};

const WIDTH = 100;

/**
 * A compact line/area chart in normalised viewBox units, so it stretches to
 * whatever the tile gives it without recalculating anything.
 */
export function Sparkline({ values, min, max, from, to, height = 44, area = true, className }: SparklineProps) {
  const reduced = usePrefersReducedMotion();
  const gradientId = useId();

  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length < 2) {
    return <div className={className} style={{ height }} aria-hidden="true" />;
  }

  const low = min ?? Math.min(...present);
  const high = max ?? Math.max(...present);
  const span = high - low || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * WIDTH;
    const normalised = value === null ? low : value;
    const y = height - ((normalised - low) / span) * height;
    return [x, Math.max(1, Math.min(height - 1, y))] as const;
  });

  // Catmull-Rom style smoothing keeps the curve organic without overshooting
  // into implausible values the way a naive bezier does.
  const line = points
    .map(([x, y], index) => {
      if (index === 0) return `M ${x} ${y}`;
      const [px, py] = points[index - 1];
      const cx = (px + x) / 2;
      return `C ${cx} ${py} ${cx} ${y} ${x} ${y}`;
    })
    .join(' ');

  const fill = `${line} L ${WIDTH} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height, width: '100%', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={to} stopOpacity="0.42" />
          <stop offset="100%" stopColor={to} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {area ? (
        <motion.path
          d={fill}
          fill={`url(#${gradientId}-fill)`}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        />
      ) : null}

      <motion.path
        d={line}
        fill="none"
        stroke={`url(#${gradientId}-stroke)`}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
