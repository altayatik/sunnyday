import { readStorage, removeStorage, writeStorage } from '../cache';

type StoredScore = {
  score: number;
  at: number;
};

const KEY_PREFIX = 'sunnyday:score:v1:';

/** Within this window a small change is treated as model noise, not news. */
const NOISE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Changes of this size or smaller do not move the displayed number. */
const NOISE_THRESHOLD = 2;

const storageKey = (locationId: string, date: string) => `${KEY_PREFIX}${locationId}:${date}`;

/**
 * Damps meaningless movement in the displayed score.
 *
 * Every model run shifts the underlying numbers a point or two. Surfacing
 * that verbatim is what makes mainstream weather apps feel untrustworthy:
 * you check twice in ten minutes, the number changed, and you conclude the
 * app is guessing. It usually is not - the weather did not change, the
 * arithmetic just landed slightly differently.
 *
 * So a change of 2 points or less inside a two-hour window keeps the score
 * you were already shown. Anything larger is real and passes straight
 * through, because suppressing a genuine change would be far worse than
 * showing a jittery one.
 */
export const stabiliseScore = (locationId: string, date: string, incoming: number, now = Date.now()): number => {
  const key = storageKey(locationId, date);
  const stored = readStorage<StoredScore>(key);

  if (stored && now - stored.at < NOISE_WINDOW_MS && Math.abs(incoming - stored.score) <= NOISE_THRESHOLD) {
    // Keep the number the person already saw, but refresh nothing: letting
    // `at` age out means a slow drift eventually surfaces rather than being
    // pinned forever by a series of individually-small changes.
    return stored.score;
  }

  writeStorage<StoredScore>(key, { score: incoming, at: now });
  return incoming;
};

/** Clears the damping record, e.g. when the person explicitly refreshes. */
export const resetScoreStability = (locationId: string, date: string) => {
  removeStorage(storageKey(locationId, date));
};
