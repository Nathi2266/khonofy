import { addDays, addWeeks, eachDayOfInterval, format, getDay, startOfDay } from 'date-fns';

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
];

export const MAX_RECURRING_ENTRIES = 200;

export function defaultRecurringDaysForDate(date) {
  return [getDay(date)];
}

export function createDefaultRecurringState(startDate) {
  const start = startOfDay(startDate);
  return {
    recurring_enabled: false,
    recurring_end_date: addWeeks(start, 4),
    recurring_days: defaultRecurringDaysForDate(start),
  };
}

export function buildRecurringOccurrences({
  startAt,
  endAt,
  recurringEndDate,
  recurringDays,
}) {
  const rangeStart = startOfDay(startAt);
  const rangeEnd = startOfDay(recurringEndDate);
  if (rangeEnd < rangeStart) return [];

  const selectedDays = new Set(
    (Array.isArray(recurringDays) ? recurringDays : []).map((day) => Number(day))
  );
  if (!selectedDays.size) return [];

  const durationMs = endAt.getTime() - startAt.getTime();
  const startHours = startAt.getHours();
  const startMinutes = startAt.getMinutes();

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    .filter((day) => selectedDays.has(getDay(day)))
    .slice(0, MAX_RECURRING_ENTRIES)
    .map((day) => {
      const occurrenceStart = new Date(day);
      occurrenceStart.setHours(startHours, startMinutes, 0, 0);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      return {
        start_at: occurrenceStart,
        end_at: occurrenceEnd,
      };
    });
}

export function countRecurringOccurrences(options) {
  return buildRecurringOccurrences(options).length;
}

export function formatRecurringSummary({ startAt, recurringEndDate, recurringDays, occurrenceCount }) {
  const dayLabels = WEEKDAY_OPTIONS
    .filter((option) => recurringDays.includes(option.value))
    .map((option) => option.label)
    .join(', ');

  return `${occurrenceCount} entries from ${format(startAt, 'MMM d, yyyy')} to ${format(recurringEndDate, 'MMM d, yyyy')} on ${dayLabels || 'selected days'}.`;
}

export function normalizeRecurringEndDate(startAt, recurringEndDate) {
  const start = startOfDay(startAt);
  const end = startOfDay(recurringEndDate || addWeeks(start, 4));
  return end < start ? addDays(start, 7) : end;
}
