import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../lib/motion';

type BarSeriesProps = {
  values: Array<number | null>;
  /** Values at or above this get the emphasis colour. */
  threshold?: number;
  base: string;
  emphasis: string;
  height?: number;
  max?: number;
  className?: string;
};

/**
 * Compact bar series for hourly probability data.
 *
 * Bars rather than a line because precipitation probability is a per-hour
 * quantity, not a continuous signal - drawing it as a smooth curve implies
 * an interpolation the data does not support.
 */
export function BarSeries({
  values,
  threshold = 50,
  base,
  emphasis,
  height = 44,
  max = 100,
  className,
}: BarSeriesProps) {
  const reduced = usePrefersReducedMotion();

  return (
    // Each bar is full-height and scaled from its base. Animating `height`
    // made every frame of every bar trigger layout on the main thread;
    // `scaleY` is a compositor-only transform, so the whole series is free.
    <div className={`flex items-end gap-[2px] ${className ?? ''}`} style={{ height }} aria-hidden="true">
      {values.map((value, index) => {
        const magnitude = Math.max(0, Math.min(max, value ?? 0));
        const ratio = Math.max(0.06, magnitude / max);
        const hot = magnitude >= threshold;
        return (
          <motion.span
            key={index}
            className="min-w-0 flex-1 rounded-[2px]"
            style={{
              background: hot ? emphasis : base,
              height: '100%',
              transformOrigin: 'bottom',
              opacity: value === null ? 0.25 : 1,
            }}
            initial={reduced ? false : { scaleY: 0 }}
            animate={{ scaleY: ratio }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}
