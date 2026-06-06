import { Badge } from '@/components/ui/badge';

function formatTimeRange(entry) {
  if (entry.start_at && entry.end_at) {
    const start = new Date(entry.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const end = new Date(entry.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${start} - ${end}`;
  }
  return `${entry.hours || 0}h`;
}

export default function TimesheetEntriesPanel({ entries = [], compact = false }) {
  if (!entries.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground">
        No linked time entries found for this timesheet.
      </div>
    );
  }

  if (compact) {
    const sortedEntries = [...entries].sort((left, right) => {
      const leftDate = new Date(left.date || left.start_at || 0).getTime();
      const rightDate = new Date(right.date || right.start_at || 0).getTime();
      return leftDate - rightDate;
    });

    return (
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Task</th>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Project</th>
              <th className="px-3 py-2 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry) => (
              <tr key={entry.id} className="border-t border-border/70">
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                  {new Date(entry.date || entry.start_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">{entry.task_title || 'Task'}</p>
                  {entry.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{entry.description}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatTimeRange(entry)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{entry.project_name || '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-primary">{Number(entry.hours || 0).toFixed(1)}h</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/20">
            <tr>
              <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-bold text-foreground">
                {sortedEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0).toFixed(1)}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{entry.task_title || 'Task'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(entry.date).toLocaleDateString()}</span>
                {entry.start_at ? <span>{formatTimeRange(entry)}</span> : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-primary">{entry.hours}h</p>
              {entry.billable ? (
                <Badge variant="secondary" className="mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Billable
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {entry.project_name ? (
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                Project: {entry.project_name}
              </Badge>
            ) : null}
            {entry.client_name ? (
              <Badge variant="outline" className="border-border bg-muted/40">
                Client: {entry.client_name}
              </Badge>
            ) : null}
            {entry.tag_name ? (
              <span
                className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: entry.tag_color || '#6366f1' }}
              >
                Tag: {entry.tag_name}
              </span>
            ) : null}
          </div>

          {entry.description ? (
            <p className="mt-3 text-sm text-muted-foreground">{entry.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
