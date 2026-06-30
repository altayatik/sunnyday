type CacheRecord<T> = {
  expiresAt: number;
  value: T;
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
  const record = safeParse<CacheRecord<T>>(localStorage.getItem(key));

  if (!record || Date.now() > record.expiresAt) {
    localStorage.removeItem(key);
    return null;
  }

  return record.value;
};

export const writeCache = <T>(key: string, value: T, ttlMs: number) => {
  const record: CacheRecord<T> = {
    expiresAt: Date.now() + ttlMs,
    value,
  };

  localStorage.setItem(key, JSON.stringify(record));
};

export const readStorage = <T>(key: string): T | null => safeParse<T>(localStorage.getItem(key));

export const writeStorage = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};
