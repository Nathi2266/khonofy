import {
  addDays,
  differenceInMinutes,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';

export const MINUTES_IN_DAY = 24 * 60;
export const SNAP_MINUTES = 15;
export const HOUR_HEIGHT = 64;
export const PX_PER_MINUTE = HOUR_HEIGHT / 60;

export function snapMinutes(value) {
  const snapped = Math.round(value / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.max(0, Math.min(MINUTES_IN_DAY, snapped));
}

export function clampMinutes(value) {
  return Math.max(0, Math.min(MINUTES_IN_DAY, value));
}

export function getWeekDates(offset = 0) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index + offset * 7));
}

export function getWeekRange(offset = 0) {
  const dates = getWeekDates(offset);
  return {
    dates,
    start: startOfDay(dates[0]),
    endExclusive: addDays(startOfDay(dates[6]), 1),
    endDisplay: endOfWeek(dates[0], { weekStartsOn: 1 }),
  };
}

export function parseEntryDate(entry) {
  return {
    startAt: entry.start_at ? parseISO(entry.start_at) : parseISO(`${entry.date}T00:00:00.000Z`),
    endAt: entry.end_at
      ? parseISO(entry.end_at)
      : new Date(parseISO(`${entry.date}T00:00:00.000Z`).getTime() + Number(entry.hours || 1) * 60 * 60 * 1000),
  };
}

export function minutesFromMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatClockLabel(date) {
  return format(date, 'HH:mm');
}

export function formatRangeLabel(startAt, endAt) {
  return `${format(startAt, 'HH:mm')} - ${format(endAt, 'HH:mm')}`;
}

export function buildDateTime(dateString, minutes) {
  const day = parseISO(`${dateString}T00:00:00`);
  day.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return day;
}

export function toDateInputValue(date) {
  return format(date, 'yyyy-MM-dd');
}

export function toTimeInputValue(date) {
  return format(date, 'HH:mm');
}

export function parseDateTimeInput(dateString, timeString) {
  const [hours, minutes] = String(timeString || '00:00').split(':').map(Number);
  const date = parseISO(`${dateString}T00:00:00`);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export function durationMinutes(startAt, endAt) {
  return Math.max(SNAP_MINUTES, differenceInMinutes(endAt, startAt));
}

export function layoutEntriesForDay(entries) {
  const sorted = [...entries].sort((left, right) => {
    const leftStart = parseEntryDate(left).startAt.getTime();
    const rightStart = parseEntryDate(right).startAt.getTime();
    return leftStart - rightStart;
  });

  const columns = [];
  return sorted.map((entry) => {
    const { startAt, endAt } = parseEntryDate(entry);
    let columnIndex = 0;

    while (
      columns[columnIndex] &&
      columns[columnIndex].some((existing) => {
        const existingRange = parseEntryDate(existing);
        return startAt < existingRange.endAt && endAt > existingRange.startAt;
      })
    ) {
      columnIndex += 1;
    }

    if (!columns[columnIndex]) columns[columnIndex] = [];
    columns[columnIndex].push(entry);

    return {
      ...entry,
      columnIndex,
      columnCount: Math.max(columns.length, 1),
      startAt,
      endAt,
      top: minutesFromMidnight(startAt) * PX_PER_MINUTE,
      height: Math.max(durationMinutes(startAt, endAt) * PX_PER_MINUTE, 24),
    };
  }).map((entry) => ({
    ...entry,
    columnCount: columns.length || 1,
  }));
}

export function isTodayInView(date) {
  return isSameDay(date, new Date());
}
