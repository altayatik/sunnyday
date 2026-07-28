import { motion } from 'framer-motion';
import type { HourlySunnyData, OutdoorWindow } from '../../types/weather';
import { formatHour } from '../../lib/date';
import { usePrefersReducedMotion } from '../../lib/motion';

type DayTimelineProps = {
  hours: HourlySunnyData[];
  window: OutdoorWindow | null;
  timeZone?: string;
};

/**
 * Per-hour quality, coloured. Green reads as "go", rose as "don't", and the
 * gap between them is legible at a glance without reading a single number -
 * which is the point of putting the best window on a strip rather than in a
 * sentence.
 */
const hourColour = (hour: HourlySunnyData) => {
  const rain = hour.precipitationProbability ?? 0;
  const cloud = hour.cloudCover ?? 0;
  if (hour.isDay === false) return 'rgba(148, 176, 208, 0.28)';
  if (rain >= 60) return '#fb7185';
  if (rain >= 35) return '#fb923c';
  if (cloud >= 80) return '#94a3b8';
  if (cloud >= 50) return '#7dd3fc';
  return '#4ade80';
};

/** A day-long strip with the recommended outdoor window called out. */
export function DayTimeline({ hours, window, timeZone }: DayTimelineProps) {
  const reduced = usePrefersReducedMotion();
  const strip = hours.slice(0, 18);
  if (strip.length < 2) return null;

  const startIndex = window ? strip.findIndex((hour) => hour.time === window.startTime) : -1;
  const endIndex = window ? strip.findIndex((hour) => hour.time === window.endTime) : -1;
  const hasWindow = startIndex >= 0 && endIndex >= startIndex;

  return (
    <div>
      <div className="relative">
        <div className="flex h-9 gap-[3px] overflow-hidden rounded-lg">
          {strip.map((hour, index) => (
            <motion.span
              key={hour.time}
              className="min-w-0 flex-1"
              style={{ background: hourColour(hour) }}
              initial={reduced ? false : { opacity: 0, scaleY: 0.4 }}
              animate={{
                opacity: hasWindow && (index < startIndex || index > endIndex) ? 0.34 : 1,
                scaleY: 1,
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {hasWindow ? (
          <motion.div
            className="pointer-events-none absolute inset-y-[-3px] rounded-lg border-2 border-white/85"
            style={{
              left: `${(startIndex / strip.length) * 100}%`,
              width: `${((endIndex - startIndex + 1) / strip.length) * 100}%`,
            }}
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.18 }}
          />
        ) : null}
      </div>

      <div className="mt-1.5 flex justify-between text-[0.625rem] font-bold tabular-nums ink-hair">
        <span>{formatHour(strip[0].time, timeZone)}</span>
        <span>{formatHour(strip[strip.length - 1].time, timeZone)}</span>
      </div>
    </div>
  );
}
