import { format } from 'date-fns';
import CalendarEntryBlock from './CalendarEntryBlock';
import { HOUR_HEIGHT, MINUTES_IN_DAY, PX_PER_MINUTE, isTodayInView } from './calendarMath';

export default function CalendarDayColumn({
  date,
  entries,
  previewBlock,
  onPointerDownCreate,
  onPointerDownMove,
  onPointerDownResize,
  onOpenEntry,
  currentTimeTop,
  readOnly = false,
}) {
  const today = isTodayInView(date);

  return (
    <div className={`min-w-[180px] flex-1 border-l border-border ${readOnly ? 'bg-muted/30' : 'bg-background'}`}>
      <div className={`h-14 border-b border-border px-3 py-2 text-center ${today ? 'bg-primary/5' : 'bg-card'}`}>
        <p className="text-xs font-medium text-muted-foreground">{format(date, 'EEE')}</p>
        <p className={`text-lg font-semibold ${today ? 'text-primary' : 'text-foreground'}`}>{format(date, 'd')}</p>
      </div>

      <div
        data-day-column="true"
        data-date={format(date, 'yyyy-MM-dd')}
        className={`relative select-none ${readOnly ? 'cursor-not-allowed' : ''}`}
        style={{ height: MINUTES_IN_DAY * PX_PER_MINUTE }}
        onPointerDown={readOnly ? undefined : (event) => onPointerDownCreate(event, date)}
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="border-b border-border/70"
            style={{ height: HOUR_HEIGHT }}
          />
        ))}

        {today && currentTimeTop !== null ? (
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 border-t border-red-500"
            style={{ top: currentTimeTop }}
          >
            <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
          </div>
        ) : null}

        {previewBlock ? (
          <div
            className="pointer-events-none absolute left-1 right-1 rounded-lg border border-primary/50 bg-primary/15"
            style={{
              top: previewBlock.top,
              height: previewBlock.height,
            }}
          />
        ) : null}

        {entries.map((entry) => (
          <CalendarEntryBlock
            key={entry.id}
            entry={entry}
            readOnly={readOnly}
            onPointerDownMove={onPointerDownMove}
            onPointerDownResize={onPointerDownResize}
            onOpen={onOpenEntry}
          />
        ))}
      </div>
    </div>
  );
}
