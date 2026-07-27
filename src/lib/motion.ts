import { useEffect, useRef, useState } from 'react';

/** Tracks the OS reduced-motion preference and reacts to changes. */
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
};

/** Tracks the breakpoint where cards open as bottom sheets instead of dialogs. */
export const usePhoneLayout = () => {
  const [phone, setPhone] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return phone;
};

/**
 * Counts from the previously shown value to `target`.
 *
 * A number that animates into place reads as "computed" rather than "swapped",
 * which is most of why a score feels authoritative. Starting from the previous
 * value rather than zero means a refresh nudges the number instead of
 * re-running the whole animation.
 */
export const useCountUp = (target: number, { duration = 620, enabled = true } = {}) => {
  const [value, setValue] = useState(enabled ? 0 : target);
  const fromRef = useRef(enabled ? 0 : target);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    const start = performance.now();
    // easeOutExpo: fast departure, long settle - the curve that makes a
    // counter feel like it is arriving at a considered answer.
    const ease = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(from + delta * ease(progress));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, enabled]);

  return value;
};

/** Shared spring for card entrance and hover. */
/**
 * Snappier than the usual default. A spring that takes ~600ms to settle reads
 * as sluggish no matter how smooth it is; this one is essentially done in
 * ~250ms while keeping a little overshoot.
 */
export const springy = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 };

/** Staggered container/child variants for bento entrance. */
export const bentoContainer = {
  hidden: {},
  // 9 tiles at the old 45ms meant the last one started 400ms after the first.
  // 18ms keeps the cascade legible without making the grid feel slow to load.
  show: { transition: { staggerChildren: 0.018, delayChildren: 0.02 } },
};

export const bentoItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: springy },
};
