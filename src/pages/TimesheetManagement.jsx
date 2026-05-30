import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import { Clock, Send, ChevronDown, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

function getWeekBounds(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: Clock },
  pending: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600', icon: XCircle },
};

export default function TimesheetManagement() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const week = getWeekBounds(weekOffset);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['weekEntries', user?.id, week.start, week.end],
    queryFn: () => base44.entities.TimeEntry.filter({ user_id: user.id }),
    enabled: !!user?.id,
    select: (entries) => entries.filter(e => e.date >= week.start && e.date <= week.end),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['myTimesheets', user?.id],
    queryFn: () => base44.entities.Timesheet.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  const currentSheet = timesheets.find(t => t.week_start === week.start);
  const totalHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  const submitTimesheet = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user.id,
        user_name: user.full_name || user.email,
        department_id: user.department_id || '',
        week_start: week.start,
        week_end: week.end,
        total_hours: totalHours,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      };
      if (currentSheet) {
        return base44.entities.Timesheet.update(currentSheet.id, payload);
      }
      const ts = await base44.entities.Timesheet.create(payload);
      // link entries
      await Promise.all(timeEntries.map(e =>
        base44.entities.TimeEntry.update(e.id, { timesheet_id: ts.id })
      ));
      return ts;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['myTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['weekEntries'] });
      if (user) await logActivity(user, 'Submitted timesheet', 'Timesheet', '', `Week of ${week.start} (${totalHours}h)`);
    },
  });

  // Group entries by date
  const byDate = timeEntries.reduce((acc, e) => {
    const d = e.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {});

  const dayLabels = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(week.start);
    d.setDate(d.getDate() + i);
    dayLabels.push(d.toISOString().split('T')[0]);
  }

  const canSubmit = totalHours > 0 && (!currentSheet || currentSheet.status === 'draft' || currentSheet.status === 'rejected');

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Timesheets</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and submit your weekly time for approval.</p>
      </div>

      {/* Week selector */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              ‹
            </button>
            <div className="text-center">
              <p className="font-semibold text-foreground text-sm">
                Week of {new Date(week.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(week.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              {weekOffset === 0 && <p className="text-xs text-primary font-medium">Current Week</p>}
            </div>
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              disabled={weekOffset >= 0}
              className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">this week</p>
            </div>
            {currentSheet && (
              <StatusBadge status={currentSheet.status} />
            )}
          </div>
        </div>

        {currentSheet?.admin_notes && currentSheet.status === 'rejected' && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs font-semibold text-red-700">Rejection reason:</p>
            <p className="text-sm text-red-700 mt-0.5">{currentSheet.admin_notes}</p>
          </div>
        )}

        {/* Days */}
        <div className="space-y-2">
          {dayLabels.map(dateStr => {
            const entries = byDate[dateStr] || [];
            const dayHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
            const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const hasEntries = entries.length > 0;
            return (
              <div
                key={dateStr}
                className={`rounded-lg border transition-colors ${isToday ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
              >
                <div
                  className={`flex items-center justify-between px-3 py-2.5 ${hasEntries ? 'cursor-pointer' : ''}`}
                  onClick={() => hasEntries && setExpanded(expanded === dateStr ? null : dateStr)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>{dayName}</span>
                    {isToday && <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full font-medium">Today</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${dayHours > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {dayHours > 0 ? `${dayHours.toFixed(1)}h` : '—'}
                    </span>
                    {hasEntries && (
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === dateStr ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </div>
                {expanded === dateStr && (
                  <div className="border-t border-border px-3 pb-3 space-y-1.5">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-start justify-between py-1.5 px-2 rounded-md bg-background">
                        <div>
                          <p className="text-sm font-medium text-foreground">{e.task_title || 'Task'}</p>
                          {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                        </div>
                        <span className="text-sm font-semibold text-primary ml-4 flex-shrink-0">{e.hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => submitTimesheet.mutate()}
            disabled={!canSubmit || submitTimesheet.isPending}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            {submitTimesheet.isPending ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </div>
      </div>

      {/* Past timesheets */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-4">Timesheet History</h2>
        <div className="space-y-2">
          {timesheets.sort((a, b) => new Date(b.week_start) - new Date(a.week_start)).map(ts => (
            <div key={ts.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {new Date(ts.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' – '}
                  {new Date(ts.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs text-muted-foreground">{ts.total_hours || 0}h logged</p>
                {ts.admin_notes && ts.status === 'rejected' && (
                  <p className="text-xs text-red-600 mt-0.5">Note: {ts.admin_notes}</p>
                )}
              </div>
              <StatusBadge status={ts.status} />
            </div>
          ))}
          {timesheets.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">No timesheets submitted yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}