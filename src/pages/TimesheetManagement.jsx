import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import { TIMESHEET_STATUS_ICONS } from '@/constants/dashboardIcons';
import dashboardIcon5 from '@/assets/images/dashboard/5.png';
import dashboardIcon10 from '@/assets/images/dashboard/10.png';
import dashboardIcon18 from '@/assets/images/dashboard/18.png';
import { Send, ChevronDown, Undo2, RotateCcw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const REVOKE_WINDOW_MS = 24 * 60 * 60 * 1000;

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

function getReviewedAt(timesheet) {
  if (timesheet.reviewed_at) return new Date(timesheet.reviewed_at);
  if (timesheet.status === 'approved' && timesheet.updated_date) return new Date(timesheet.updated_date);
  return null;
}

function canRevokeTimesheet(timesheet) {
  if (timesheet.status !== 'approved') return false;
  const reviewedAt = getReviewedAt(timesheet);
  if (!reviewedAt) return false;
  return Date.now() - reviewedAt.getTime() <= REVOKE_WINDOW_MS;
}

function getRevokeDeadline(timesheet) {
  const reviewedAt = getReviewedAt(timesheet);
  if (!reviewedAt) return null;
  return new Date(reviewedAt.getTime() + REVOKE_WINDOW_MS);
}

function invalidateTimesheetQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['myTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['weekEntries'] });
  queryClient.invalidateQueries({ queryKey: ['teamTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['allTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['pendingTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['revokePendingTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['projectApprovedStats'] });
  queryClient.invalidateQueries({ queryKey: ['myTasks'] });
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', iconSrc: TIMESHEET_STATUS_ICONS.draft },
  pending: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', iconSrc: TIMESHEET_STATUS_ICONS.pending },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', iconSrc: TIMESHEET_STATUS_ICONS.approved },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600', iconSrc: TIMESHEET_STATUS_ICONS.rejected },
  revoke_pending: { label: 'Revocation Pending', color: 'bg-purple-100 text-purple-700', useLucide: RotateCcw },
};

export default function TimesheetManagement() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [timesheetToWithdraw, setTimesheetToWithdraw] = useState(null);
  const [timesheetToRevoke, setTimesheetToRevoke] = useState(null);
  const week = getWeekBounds(weekOffset);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['weekEntries', user?.id, week.start, week.end],
    queryFn: () => base44.entities.TimeEntry.filter({ user_id: user.id }),
    enabled: !!user?.id,
    select: (entries) => entries.filter((entry) => entry.date >= week.start && entry.date <= week.end),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['myTimesheets', user?.id],
    queryFn: () => base44.entities.Timesheet.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user?.department_id,
  });

  const weeklyHourTarget = Number(
    departments.find((department) => department.id === user?.department_id)?.weekly_hour_target || 0
  );

  const currentSheet = timesheets.find((timesheet) => timesheet.week_start === week.start);
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const hasAssignedAdmin = !!user?.admin_id;
  const currentSheetStatus = currentSheet?.status || 'draft';
  const weeklyHourTargetLabel = weeklyHourTarget > 0 ? `${weeklyHourTarget.toFixed(1).replace(/\.0$/, '')}h` : 'No target';
  const readinessChecklist = [
    {
      label: 'Admin assigned',
      passed: hasAssignedAdmin,
      detail: hasAssignedAdmin
        ? 'You can submit this week to your assigned admin.'
        : 'A super admin must assign an admin before submission is allowed.',
    },
    {
      label: 'Time logged this week',
      passed: totalHours > 0,
      detail: totalHours > 0
        ? `${totalHours.toFixed(1)}h logged so far.`
        : 'Log at least one time entry before submitting.',
    },
    {
      label: 'Weekly target met',
      passed: !weeklyHourTarget || totalHours >= weeklyHourTarget,
      detail: !weeklyHourTarget
        ? 'No weekly target is set for your department.'
        : `${totalHours.toFixed(1)}h logged of ${weeklyHourTargetLabel} required.`,
    },
    {
      label: 'Week is editable',
      passed: !currentSheet || currentSheetStatus === 'draft' || currentSheetStatus === 'rejected',
      detail: currentSheetStatus === 'approved'
        ? 'Approved sheets are locked until a revocation is approved.'
        : currentSheetStatus === 'revoke_pending'
          ? 'The sheet is locked while your revocation request is waiting.'
          : 'This week can be submitted.',
    },
  ];
  const blockedChecklistItems = readinessChecklist.filter((item) => !item.passed);
  const isLocked = currentSheetStatus === 'approved' || currentSheetStatus === 'revoke_pending';
  const lockReason = currentSheetStatus === 'approved'
    ? 'This timesheet is locked because it has been approved.'
    : currentSheetStatus === 'revoke_pending'
      ? 'This timesheet is locked while your revocation request is waiting for admin review.'
      : '';
  const statusLabel = STATUS_CONFIG[currentSheetStatus]?.label || currentSheetStatus;

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
        admin_notes: '',
        reviewed_by: null,
        reviewed_by_name: '',
        reviewed_at: null,
      };
      const linkEntries = async (timesheetId) => {
        for (const entry of timeEntries) {
          await base44.entities.TimeEntry.update(entry.id, { timesheet_id: timesheetId });
        }
      };

      if (currentSheet) {
        const updated = await base44.entities.Timesheet.update(currentSheet.id, payload);
        await linkEntries(currentSheet.id);
        return updated;
      }
      const timesheet = await base44.entities.Timesheet.create(payload);
      await linkEntries(timesheet.id);
      return timesheet;
    },
    onSuccess: async () => {
      invalidateTimesheetQueries(queryClient);
      if (user) await logActivity(user, 'Submitted timesheet', 'Timesheet', '', `Week of ${week.start} (${totalHours}h)`);
    },
  });

  const withdrawTimesheet = useMutation({
    mutationFn: async (timesheet) => {
      return base44.entities.Timesheet.update(timesheet.id, { status: 'draft' });
    },
    onSuccess: async (_updated, timesheet) => {
      invalidateTimesheetQueries(queryClient);
      if (user) {
        await logActivity(
          user,
          'Withdrew timesheet submission',
          'Timesheet',
          timesheet.id,
          `Week of ${timesheet.week_start}`
        );
      }
      setTimesheetToWithdraw(null);
    },
  });

  const revokeTimesheet = useMutation({
    mutationFn: async (timesheet) => {
      return base44.entities.Timesheet.update(timesheet.id, { status: 'revoke_pending' });
    },
    onSuccess: async (_updated, timesheet) => {
      invalidateTimesheetQueries(queryClient);
      toast({
        title: 'Revoke request submitted',
        description: 'Your admin has been notified and will approve or decline your request in Timesheet Review.',
        centered: true,
        duration: 3000,
      });
      if (user) {
        await logActivity(
          user,
          'Requested timesheet revocation',
          'Timesheet',
          timesheet.id,
          `Week of ${timesheet.week_start}`
        );
      }
      setTimesheetToRevoke(null);
    },
  });

  const byDate = timeEntries.reduce((acc, entry) => {
    const dateKey = entry.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(entry);
    return acc;
  }, {});

  const dayLabels = [];
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(week.start);
    date.setDate(date.getDate() + index);
    dayLabels.push(date.toISOString().split('T')[0]);
  }

  const meetsHourTarget = !weeklyHourTarget || totalHours >= weeklyHourTarget;
  const canSubmit = hasAssignedAdmin
    && totalHours > 0
    && meetsHourTarget
    && (!currentSheet || currentSheet.status === 'draft' || currentSheet.status === 'rejected');
  const currentSheetRevokeDeadline = currentSheet ? getRevokeDeadline(currentSheet) : null;

  return (
    <PageShell>
      <PageHeader
        title="My Timesheets"
        description="Review and submit your weekly time for approval."
      />

      {!hasAssignedAdmin ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <DashboardIcon src={dashboardIcon18} className={`mt-0.5 shrink-0 ${DASHBOARD_ICON_SIZES.section}`} />
          <div>
            <p className="text-sm font-semibold text-amber-900">No admin assigned yet</p>
            <p className="mt-1 text-xs text-amber-800">
              You cannot submit a timesheet for approval until a super admin allocates an admin to you. You can still log time on your calendar in the meantime.
            </p>
          </div>
        </div>
      ) : null}

      <div className="w-full space-y-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                ‹
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  Week of {new Date(week.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' – '}
                  {new Date(week.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {weekOffset === 0 ? <p className="text-xs font-medium text-primary">Current Week</p> : null}
              </div>
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                disabled={weekOffset >= 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-3">
              <DashboardIcon src={dashboardIcon5} className={DASHBOARD_ICON_SIZES.section} />
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">this week</p>
              </div>
              {currentSheet ? <StatusBadge status={currentSheet.status} /> : null}
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Submission readiness</p>
                <p className="text-xs text-muted-foreground">
                  {currentSheet ? `Current status: ${statusLabel}.` : 'Current status: Draft. This week has not been submitted yet.'}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {blockedChecklistItems.length === 0 ? 'Ready to submit' : `${blockedChecklistItems.length} item${blockedChecklistItems.length > 1 ? 's' : ''} missing`}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {readinessChecklist.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    item.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs font-semibold">{item.passed ? 'Ready' : 'Missing'}</span>
                  </div>
                  <p className="mt-1 text-xs opacity-90">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {currentSheet?.status === 'pending' ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <span>This timesheet is waiting for admin review.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                onClick={() => setTimesheetToWithdraw(currentSheet)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Withdraw
              </Button>
            </div>
          ) : null}

          {currentSheet?.status === 'revoke_pending' ? (
            <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-800">
              Your revocation request is waiting for admin approval. The calendar stays locked until your admin approves or declines it.
              {currentSheet.revoke_requested_at ? (
                <span className="mt-1 block text-xs text-purple-700">
                  Requested on {new Date(currentSheet.revoke_requested_at).toLocaleString()}
                </span>
              ) : null}
            </div>
          ) : null}

          {currentSheet?.status === 'approved' && canRevokeTimesheet(currentSheet) ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span>
                Approved. You can revoke until {currentSheetRevokeDeadline?.toLocaleString()}.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                onClick={() => setTimesheetToRevoke(currentSheet)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          ) : null}

          {currentSheet?.status === 'draft' && currentSheet.withdrawn_at ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              You withdrew this timesheet on {new Date(currentSheet.withdrawn_at).toLocaleString()}. You can edit your entries and submit again.
            </div>
          ) : null}

          {currentSheet?.status === 'draft' && currentSheet.revoked_at ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Your admin approved your revocation on {new Date(currentSheet.revoked_at).toLocaleString()}. You can edit your entries and submit again.
            </div>
          ) : null}

          {currentSheet?.admin_notes && currentSheet.status === 'rejected' ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">Rejection reason:</p>
              <p className="mt-0.5 text-sm text-red-700">{currentSheet.admin_notes}</p>
            </div>
          ) : null}

          {isLocked ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {lockReason}
            </div>
          ) : null}

          <div className="space-y-2">
            {dayLabels.map((dateStr) => {
              const entries = byDate[dateStr] || [];
              const dayHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
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
                      {isToday ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-white">Today</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${dayHours > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {dayHours > 0 ? `${dayHours.toFixed(1)}h` : '—'}
                      </span>
                      {hasEntries ? (
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded === dateStr ? 'rotate-180' : ''}`} />
                      ) : null}
                    </div>
                  </div>
                  {expanded === dateStr ? (
                    <div className="space-y-1.5 border-t border-border px-3 pb-3">
                      {entries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between rounded-md bg-background px-2 py-1.5">
                          <div>
                            <p className="text-sm font-medium text-foreground">{entry.task_title || 'Task'}</p>
                            {entry.description ? <p className="text-xs text-muted-foreground">{entry.description}</p> : null}
                          </div>
                          <span className="ml-4 flex-shrink-0 text-sm font-semibold text-primary">{entry.hours}h</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

        <div className="mt-4 flex flex-col items-end gap-2">
          {!hasAssignedAdmin ? (
            <p className="text-xs text-muted-foreground">Submit is unavailable until an admin is assigned to you.</p>
          ) : null}
          {hasAssignedAdmin && weeklyHourTarget > 0 && !meetsHourTarget ? (
            <p className="text-xs text-amber-700">
              You need at least {weeklyHourTargetLabel} logged this week before you can submit ({totalHours.toFixed(1)}h so far).
            </p>
          ) : null}
            <Button
              onClick={() => submitTimesheet.mutate()}
              disabled={!canSubmit || submitTimesheet.isPending || isLocked}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitTimesheet.isPending ? 'Submitting...' : currentSheetStatus === 'revoke_pending' ? 'Locked for Revocation Review' : 'Submit for Approval'}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold text-foreground">Timesheet History</h2>
          <div className="space-y-2">
            {[...timesheets].sort((left, right) => new Date(right.week_start).getTime() - new Date(left.week_start).getTime()).map((timesheet) => (
              <div key={timesheet.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/60">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(timesheet.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' – '}
                    {new Date(timesheet.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-muted-foreground">{timesheet.total_hours || 0}h logged</p>
                  {timesheet.withdrawn_at ? (
                    <p className="mt-0.5 text-xs text-slate-600">
                      Withdrawn on {new Date(timesheet.withdrawn_at).toLocaleString()}
                    </p>
                  ) : null}
                  {timesheet.revoke_requested_at && timesheet.status === 'revoke_pending' ? (
                    <p className="mt-0.5 text-xs text-purple-700">
                      Revoke requested on {new Date(timesheet.revoke_requested_at).toLocaleString()}
                    </p>
                  ) : null}
                  {timesheet.revoked_at && timesheet.status === 'draft' ? (
                    <p className="mt-0.5 text-xs text-slate-600">
                      Revocation approved on {new Date(timesheet.revoked_at).toLocaleString()}
                    </p>
                  ) : null}
                  {timesheet.admin_notes && timesheet.status === 'rejected' ? (
                    <p className="mt-0.5 text-xs text-red-600">Note: {timesheet.admin_notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={timesheet.status} />
                  {timesheet.status === 'pending' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setTimesheetToWithdraw(timesheet)}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Withdraw
                    </Button>
                  ) : null}
                  {canRevokeTimesheet(timesheet) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setTimesheetToRevoke(timesheet)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {timesheets.length === 0 ? (
              <div className="py-8 text-center">
                <DashboardIcon src={dashboardIcon10} className={`mx-auto mb-3 opacity-60 ${DASHBOARD_ICON_SIZES.hero}`} />
                <p className="text-sm text-muted-foreground">No timesheets submitted yet.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AlertDialog open={!!timesheetToWithdraw} onOpenChange={() => setTimesheetToWithdraw(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw submitted timesheet?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to withdraw this timesheet? It will return to draft, leave the admin review queue, and you can edit your entries before submitting again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawTimesheet.isPending}>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => withdrawTimesheet.mutate(timesheetToWithdraw)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={withdrawTimesheet.isPending}
            >
              {withdrawTimesheet.isPending ? 'Withdrawing...' : 'Yes, withdraw'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!timesheetToRevoke} onOpenChange={() => setTimesheetToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request timesheet revocation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to request revocation of this approved timesheet? Your admin must approve or decline before you can edit again. You can only request revocation within 1 day of approval
              {timesheetToRevoke && getRevokeDeadline(timesheetToRevoke)
                ? ` (until ${getRevokeDeadline(timesheetToRevoke).toLocaleString()}).`
                : '.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeTimesheet.isPending}>No, keep approval</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTimesheet.mutate(timesheetToRevoke)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeTimesheet.isPending}
            >
              {revokeTimesheet.isPending ? 'Submitting...' : 'Yes, request revocation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const LucideIcon = config.useLucide;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.color}`}>
      {config.iconSrc ? (
        <DashboardIcon src={config.iconSrc} className={DASHBOARD_ICON_SIZES.inline} />
      ) : LucideIcon ? (
        <LucideIcon className="h-3 w-3" />
      ) : null}
      {config.label}
    </span>
  );
}
