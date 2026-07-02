import { addDays, format, parseISO, startOfWeek } from 'date-fns';

/** Local calendar date as yyyy-MM-dd (avoids UTC shift from toISOString). */
export function getLocalToday() {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Parse a week date string in local time (noon avoids DST edge cases). */
export function parseWeekDate(dateStr) {
  return parseISO(`${dateStr}T12:00:00`);
}

/** Monday–Sunday week bounds for the given offset (0 = current week). */
export function getWeekBounds(offset = 0) {
  const monday = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offset * 7);
  const sunday = addDays(monday, 6);
  return {
    start: format(monday, 'yyyy-MM-dd'),
    end: format(sunday, 'yyyy-MM-dd'),
  };
}

/** Seven yyyy-MM-dd strings Mon–Sun for a week_start value. */
export function getWeekDayDates(weekStart) {
  const start = parseWeekDate(weekStart);
  return Array.from({ length: 7 }, (_, index) => format(addDays(start, index), 'yyyy-MM-dd'));
}

/** Consistent label: "Jun 22 – Jun 28, 2026" (matches Calendar). */
export function formatWeekRangeLabel(startStr, endStr) {
  const start = parseWeekDate(startStr);
  const end = parseWeekDate(endStr);
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

export function isCurrentWeek(weekStart) {
  return weekStart === getWeekBounds(0).start;
}

/**
 * Match a timesheet to a week. Handles legacy records whose week_start was
 * stored one day early due to UTC toISOString() on local Monday midnight.
 */
export function findTimesheetForWeek(timesheets, week) {
  const exact = timesheets.find((sheet) => sheet.week_start === week.start);
  if (exact) return exact;

  const legacyStart = format(addDays(parseWeekDate(week.start), -1), 'yyyy-MM-dd');
  return timesheets.find((sheet) => sheet.week_start === legacyStart) || null;
}
