import { cn } from '@/lib/utils';
import { formatRangeLabel } from './calendarMath';

export default function CalendarEntryBlock({
  entry,
  onPointerDownMove,
  onPointerDownResize,
  onOpen,
}) {
  const widthPercent = 100 / Math.max(entry.columnCount || 1, 1);
  const leftPercent = widthPercent * (entry.columnIndex || 0);

  return (
    <button
      type="button"
      className={cn(
        'absolute rounded-lg border border-white/20 px-2 py-1 text-left text-white shadow-md transition-transform hover:scale-[1.01]',
        'focus:outline-none focus:ring-2 focus:ring-white/60'
      )}
      style={{
        top: entry.top,
        height: entry.height,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        backgroundColor: entry.project_color || entry.tag_color || '#6366f1',
      }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(entry);
      }}
    >
      <span
        className="absolute left-1 right-1 top-0 h-2 cursor-ns-resize rounded-t-md"
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDownResize(event, entry, 'start');
        }}
      />
      <div
        className="h-full cursor-grab overflow-hidden active:cursor-grabbing"
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDownMove(event, entry);
        }}
      >
        <div className="truncate text-xs font-semibold">{entry.task_title || 'Time Entry'}</div>
        <div className="truncate text-[11px] opacity-90">{formatRangeLabel(entry.startAt, entry.endAt)}</div>
        {entry.project_name ? <div className="truncate text-[11px] opacity-80">{entry.project_name}</div> : null}
        {entry.billable ? (
          <span className="mt-1 inline-flex rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">
            Billable
          </span>
        ) : null}
      </div>
      <span
        className="absolute bottom-0 left-1 right-1 h-2 cursor-ns-resize rounded-b-md"
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDownResize(event, entry, 'end');
        }}
      />
    </button>
  );
}
