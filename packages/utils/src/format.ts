/** Locale-aware date helpers that degrade to an em dash on invalid input. */

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: Date | string | number, locale = 'en-US'): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: Date | string | number, locale = 'en-US'): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}
