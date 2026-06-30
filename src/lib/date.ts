export const formatHour = (isoTime: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    timeZone,
  }).format(new Date(isoTime));

export const formatShortDay = (isoDate: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(`${isoDate}T12:00:00`));

export const formatClock = (isoTime: string | null, timeZone?: string) => {
  if (!isoTime) return 'Unavailable';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(isoTime));
};

export const formatDurationHours = (seconds: number | null) => {
  if (seconds === null) return 'Unavailable';
  return `${Math.round(seconds / 3600)}h`;
};

export const dateKeyInTimeZone = (date = new Date(), timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
};

export const addDaysToDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
