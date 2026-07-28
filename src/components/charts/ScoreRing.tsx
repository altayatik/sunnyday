import { motion } from 'framer-motion';
import { useCountUp, usePrefersReducedMotion } from '../../lib/motion';

type ScoreRingProps = {
  score: number;
  label: string;
  /** Model consensus band, drawn as a wider translucent arc behind the value. */
  low?: number;
  high?: number;
  /** Suppresses the number until the consensus has landed. */
  settling?: boolean;
  size?: number;
};

const START_ANGLE = 135;
const SWEEP = 270;
const TRACK_WIDTH = 13;

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

/**
 * Colour is the fastest read on this screen, so the ring carries the verdict
 * before the number is legible: green is go, amber is mixed, rose is don't.
 */
const ringColours = (score: number): [string, string] => {
  if (score >= 90) return ['#4ade80', '#a7f3d0'];
  if (score >= 75) return ['#34d399', '#7dd3fc'];
  if (score >= 55) return ['#fbbf24', '#7dd3fc'];
  if (score >= 35) return ['#fb923c', '#fbbf24'];
  return ['#fb7185', '#fb923c'];
};

/**
 * The centrepiece: a 270° gauge showing the SunnyDay score, with the model
 * consensus range drawn behind it so the uncertainty is visible rather than
 * hidden behind a single confident-looking integer.
 *
 * No SVG filter on the value arc. `feGaussianBlur` is re-rasterised on every
 * frame of the sweep, which made the one element people look at first the
 * most expensive thing on screen. The gradient alone carries it.
 */
export function ScoreRing({ score, label, low, high, settling = false, size = 220 }: ScoreRingProps) {
  const reduced = usePrefersReducedMotion();
  const animated = useCountUp(settling ? 0 : score, { enabled: !reduced && !settling });
  const shown = settling ? 0 : reduced ? score : animated;

  const centre = size / 2;
  const radius = centre - TRACK_WIDTH;
  const [from, to] = ringColours(score);
  const gradientId = `score-ring-${Math.round(score)}`;

  const valueAngle = START_ANGLE + (SWEEP * Math.max(0, Math.min(100, score))) / 100;
  const hasBand = low !== undefined && high !== undefined && high > low;

  return (
    // Sized by its container rather than fixed pixels: the page never scrolls,
    // so this has to shrink to whatever height the grid row can spare.
    <div className="relative grid aspect-square w-full max-w-[13.75rem] place-items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={arcPath(centre, centre, radius, START_ANGLE, START_ANGLE + SWEEP)}
          fill="none"
          stroke="rgba(6, 22, 32, 0.34)"
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
        />

        {/* Consensus band */}
        {hasBand ? (
          <path
            d={arcPath(
              centre,
              centre,
              radius,
              START_ANGLE + (SWEEP * low) / 100,
              START_ANGLE + (SWEEP * high) / 100,
            )}
            fill="none"
            stroke="rgba(255, 255, 255, 0.26)"
            strokeWidth={TRACK_WIDTH + 7}
            strokeLinecap="round"
          />
        ) : null}

        {/* Value */}
        <motion.path
          d={arcPath(centre, centre, radius, START_ANGLE, Math.max(START_ANGLE + 0.01, valueAngle))}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: settling ? 0 : 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="@container absolute inset-0 grid place-items-center text-center">
        {settling ? (
          <div>
            <div className="mx-auto h-11 w-24 animate-pulse rounded-lg bg-white/16" />
            <p className="mt-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] ink-faint">
              Comparing models
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-center">
              <span className="text-[clamp(1.6rem,24cqi,3.25rem)] font-black leading-none tabular-nums ink">
                {Math.round(shown)}
              </span>
              <span className="ml-1 mt-1 text-[clamp(0.6rem,7cqi,1rem)] font-bold ink-hair">/100</span>
            </div>
            <p className="mt-1 text-[clamp(0.65rem,7cqi,0.9375rem)] font-black leading-tight ink">{label}</p>
            {hasBand ? (
              <p className="mt-0.5 text-[clamp(0.55rem,5cqi,0.6875rem)] font-bold tabular-nums ink-faint">
                models {low}–{high}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
