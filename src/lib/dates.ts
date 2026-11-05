/** Parse "YYYY-MM-DD" as a local calendar date (no timezone shift). */
export function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday of the ISO week that contains `d`. Weekly URLs use this date. */
export function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - dow);
  return out;
}

export function weekStartFor(value: string): string | null {
  const d = parseISODate(value);
  return d ? toISODate(mondayOf(d)) : null;
}

export function isMonday(value: string): boolean {
  const d = parseISODate(value);
  return !!d && d.getDay() === 1;
}

export function addDays(value: string, days: number): string {
  const d = parseISODate(value);
  if (!d) return value;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const long = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = value.length === 10 ? parseISODate(value) : new Date(value);
  return d && !Number.isNaN(d.getTime()) ? long.format(d) : value;
}

/** "Nov 2 – Nov 8, 2026" */
export function formatWeekRange(weekStart: string): string {
  const s = parseISODate(weekStart);
  if (!s) return weekStart;
  const e = parseISODate(addDays(weekStart, 6))!;
  return `${short.format(s)} – ${short.format(e)}, ${e.getFullYear()}`;
}
