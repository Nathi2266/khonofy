import { format } from 'date-fns';
import CalendarTimeColumn from './CalendarTimeColumn';
import CalendarDayColumn from './CalendarDayColumn';
import { layoutEntriesForDay, minutesFromMidnight, parseEntryDate } from './calendarMath';

export default function CalendarWeekGrid({
  dates,
  entries,
  previewSelection,
  currentTime,
  onPointerDownCreate,
  onPointerDownMove,
  onPointerDownResize,
  onOpenEntry,
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card">
      <CalendarTimeColumn />
      <div className="flex min-w-[980px] flex-1">
        {dates.map((date) => {
          const dayEntries = entries.filter((entry) => parseEntryDate(entry).startAt.toDateString() === date.toDateString());
          const laidOutEntries = layoutEntriesForDay(dayEntries);
          const previewBlock =
            previewSelection && format(date, 'yyyy-MM-dd') === previewSelection.date
              ? previewSelection
              : null;
          const currentTimeTop =
            currentTime && format(date, 'yyyy-MM-dd') === format(currentTime, 'yyyy-MM-dd')
              ? minutesFromMidnight(currentTime) * (64 / 60)
              : null;

          return (
            <CalendarDayColumn
              key={date.toISOString()}
              date={date}
              entries={laidOutEntries}
              previewBlock={previewBlock}
              currentTimeTop={currentTimeTop}
              onPointerDownCreate={onPointerDownCreate}
              onPointerDownMove={onPointerDownMove}
              onPointerDownResize={onPointerDownResize}
              onOpenEntry={onOpenEntry}
            />
          );
        })}
      </div>
    </div>
  );
}
