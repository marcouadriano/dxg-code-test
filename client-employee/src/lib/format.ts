const pad = (n: number) => String(n).padStart(2, '0');

// YYYY-MM-DD in the browser's timezone.
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfMonth(date: Date): string {
  return localDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

// YYYY-MM-DD HH:mm in the browser's timezone.
export function formatDateTime(ms: number): string {
  const date = new Date(ms);
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
