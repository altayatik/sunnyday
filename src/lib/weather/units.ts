export const round = (value: number | null | undefined, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value)}%`);

export const inches = (value: number | null, digits = 2) => {
  if (value === null) return '—';
  if (value > 0 && value < 0.01) return '<0.01 in';
  return `${round(value, digits)} in`;
};

export const temp = (value: number | null) => (value === null ? '—' : `${Math.round(value)}°`);

export const mph = (value: number | null) => (value === null ? '—' : `${Math.round(value)} mph`);
