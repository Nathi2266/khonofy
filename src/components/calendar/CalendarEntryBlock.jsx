import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { formatRangeLabel } from './calendarMath';

const DRAG_CLICK_THRESHOLD = 6;

export default function CalendarEntryBlock({
  entry,
  onPointerDownMove,
  onPointerDownResize,
  onOpen,
  readOnly = false,
}) {
  const pointerStartRef = useRef(null);
  const widthPercent = 100 / Math.max(entry.columnCount || 1, 1);
  const leftPercent = widthPercent * (entry.columnIndex || 0);
  const handleInset = entry.height < 36 ? 6 : 12;

  const handleMovePointerDown = (event) => {
    if (readOnly) return;
    event.stopPropagation();
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    onPointerDownMove(event, entry);
  };

  const handleOpen = (event) => {
    if (readOnly) return;
    event.stopPropagation();
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) {
      onOpen(entry);
      return;
    }
    const moved =
      Math.abs(event.clientX - start.x) > DRAG_CLICK_THRESHOLD ||
      Math.abs(event.clientY - start.y) > DRAG_CLICK_THRESHOLD;
    if (!moved) {
      onOpen(entry);
    }
  };

  const handleResizePointerDown = (event, edge) => {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    pointerStartRef.current = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onPointerDownResize(event, entry, edge);
  };

  return (
    <div
      className={cn(
        'group absolute overflow-hidden rounded-lg border border-white/20 text-left text-white shadow-md',
        'transition-shadow hover:shadow-lg'
      )}
      style={{
        top: entry.top,
        height: entry.height,
        left: `calc(${leftPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        backgroundColor: entry.project_color || entry.tag_color || '#6366f1',
      }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize start time"
        className="absolute inset-x-0 top-0 z-20 cursor-ns-resize touch-none hover:bg-white/10"
        style={{ height: handleInset }}
        onPointerDown={(event) => handleResizePointerDown(event, 'start')}
      >
        <span className="mx-auto mt-0.5 block h-1 w-8 rounded-full bg-white/40 group-hover:bg-white/60" />
      </div>

      <button
        type="button"
        className="absolute inset-x-0 z-10 cursor-grab overflow-hidden px-2 py-0.5 text-left active:cursor-grabbing"
        style={{ top: handleInset, bottom: handleInset }}
        onPointerDown={handleMovePointerDown}
        onClick={handleOpen}
      >
        <div className="truncate text-xs font-semibold">{entry.task_title || 'Time Entry'}</div>
        <div className="truncate text-[11px] opacity-90">{formatRangeLabel(entry.startAt, entry.endAt)}</div>
        {entry.project_name ? <div className="truncate text-[11px] opacity-80">{entry.project_name}</div> : null}
        {entry.billable ? (
          <span className="mt-1 inline-flex rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">
            Billable
          </span>
        ) : null}
      </button>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize end time"
        className="absolute inset-x-0 bottom-0 z-20 cursor-ns-resize touch-none hover:bg-white/10"
        style={{ height: handleInset }}
        onPointerDown={(event) => handleResizePointerDown(event, 'end')}
      >
        <span className="mx-auto mb-0.5 block h-1 w-8 rounded-full bg-white/40 group-hover:bg-white/60" />
      </div>
    </div>
  );
}
