type CacheRecord<T> = {
  expiresAt: number;
  value: T;
};

/**
 * localStorage is not reliably available.
 *
 * Safari in private browsing throws on `setItem`, some embedded webviews
 * expose no storage at all, and `setItem` throws `QuotaExceededError` once the
 * origin fills up - which this app can genuinely hit, since it caches seven
 * model forecasts per location per day. Caching is an optimisation, so every
 * failure here degrades to "no cache" rather than taking the app down.
 */
const storage = (): Storage | null => {
  try {
    if (typeof globalThis === 'undefined') return null;
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (!candidate) return null;
    return candidate;
  } catch {
    return null;
  }
};

const readRaw = (key: string): string | null => {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeRaw = (key: string, value: string) => {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Full or unavailable. Evicting our own expired entries gives the write
    // one more chance before we give up entirely.
    try {
      pruneExpired();
      storage()?.setItem(key, value);
    } catch {
      // Genuinely unavailable; proceed without a cache.
    }
  }
};

const removeRaw = (key: string) => {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
};

/** Drops expired `sunnyday:` cache records to reclaim quota. */
const pruneExpired = () => {
  const store = storage();
  if (!store) return;

  const now = Date.now();
  const doomed: string[] = [];

  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (!key?.startsWith('sunnyday:')) continue;
    const record = safeParse<CacheRecord<unknown>>(store.getItem(key));
    if (record && typeof record.expiresAt === 'number' && now > record.expiresAt) {
      doomed.push(key);
    }
  }

  for (const key of doomed) removeRaw(key);
};

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const readCache = <T>(key: string): T | null => {
  const record = safeParse<CacheRecord<T>>(readRaw(key));

  if (!record || Date.now() > record.expiresAt) {
    removeRaw(key);
    return null;
  }

  return record.value;
};

export const writeCache = <T>(key: string, value: T, ttlMs: number) => {
  const record: CacheRecord<T> = {
    expiresAt: Date.now() + ttlMs,
    value,
  };

  writeRaw(key, JSON.stringify(record));
};

export const readStorage = <T>(key: string): T | null => safeParse<T>(readRaw(key));

export const writeStorage = <T>(key: string, value: T) => {
  writeRaw(key, JSON.stringify(value));
};

export const removeStorage = (key: string) => removeRaw(key);
