/**
 * Date utility functions for chat component
 */

/**
 * Converts a Firestore timestamp to a Date object
 * @param ts - Firestore timestamp or Date-like object
 * @returns Date object or null if conversion fails
 */
export function toDateMaybe(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Checks if two dates have the same year, month, and day
 * @param a - First date
 * @param b - Second date
 * @returns True if dates match
 */
export function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formats a date as a localized day label (German)
 * @param d - Date to format
 * @returns Formatted date string
 */
export function dayLabel(d: Date): string {
  const fmt = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  return fmt.format(d).replace(/\./g, '').replace(/\s+/g, ' ');
}
