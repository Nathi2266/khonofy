import { format } from 'date-fns';
import { HOUR_HEIGHT } from './calendarMath';

const HOURS = Array.from({ length: 24 }, (_, index) => index);

export default function CalendarTimeColumn() {
  return (
    <div className="w-20 flex-shrink-0 border-r border-border bg-card">
      <div className="h-14 border-b border-border" />
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="relative border-b border-border"
          style={{ height: HOUR_HEIGHT }}
        >
          <span className="absolute -top-2 right-3 text-xs font-medium text-muted-foreground">
            {format(new Date(2024, 0, 1, hour), 'HH:mm')}
          </span>
        </div>
      ))}
    </div>
  );
}
