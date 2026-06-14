/**
 * Day-boundary helpers. Sprint 1 computes "today" in the server's local time;
 * per-user timezone support layers on later when we store the user's tz.
 */
export function dayRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
