import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import TimesheetEntriesPanel from '@/components/timesheets/TimesheetEntriesPanel';
import { CheckCircle2, XCircle, Clock, ChevronDown, Calendar, AlertCircle, ClipboardCheck, Building2, RotateCcw } from 'lucide-react';

const STATUS_TABS = ['pending', 'revoke_pending', 'approved', 'rejected', 'all'];

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  revoke_pending: 'bg-purple-100 text-purple-700',
};

const TAB_LABELS = {
  all: 'All',
  pending: 'Pending',
  revoke_pending: 'Revoke Requests',
  approved: 'Approved',
  rejected: 'Rejected',
};

function invalidateTimesheetQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['teamTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['myTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['allTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['pendingTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['revokePendingTimesheets'] });
  queryClient.invalidateQueries({ queryKey: ['projectApprovedStats'] });
  queryClient.invalidateQueries({ queryKey: ['recentLogs'] });
  queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
}

export default function TimesheetReview() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('pending');
  const [expanded, setExpanded] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const isAdmin = user?.role === 'admin';

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['teamTimesheets', user?.id],
    queryFn: () => base44.entities.Timesheet.list(),
    enabled: !!user && isAdmin,
  });

  const { data: entriesBySheet = {} } = useQuery({
    queryKey: ['allEntries', user?.id],
    queryFn: async () => {
      const entries = await base44.entities.TimeEntry.list();
      return entries.reduce((acc, entry) => {
        if (entry.timesheet_id) {
          if (!acc[entry.timesheet_id]) acc[entry.timesheet_id] = [];
          acc[entry.timesheet_id].push(entry);
        }
        return acc;
      }, {});
    },
    enabled: !!user && isAdmin,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user && isAdmin,
  });

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staffUsers', user?.id],
    queryFn: () => base44.entities.User.filter({ role: 'staff' }),
    enabled: !!user && isAdmin,
  });

  const departmentsById = useMemo(
    () => Object.fromEntries(departments.map((department) => [department.id, department])),
    [departments]
  );

  const staffById = useMemo(
    () => Object.fromEntries(staffUsers.map((staffUser) => [staffUser.id, staffUser])),
    [staffUsers]
  );

  const resolveDepartmentName = (timesheet) => {
    const departmentId = timesheet.department_id || staffById[timesheet.user_id]?.department_id;
    return departmentsById[departmentId]?.name || 'Unassigned';
  };

  const sortedTimesheets = useMemo(() => {
    return [...timesheets].sort((left, right) => {
      const leftDate = new Date(left.submitted_at || left.created_date || left.week_start);
      const rightDate = new Date(right.submitted_at || right.created_date || right.week_start);
      return rightDate - leftDate;
    });
  }, [timesheets]);

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Timesheet.update(id, {
      status: 'approved',
      reviewed_by: user.id,
      reviewed_by_name: user.full_name,
      admin_notes: '',
    }),
    onSuccess: async (_, id) => {
      invalidateTimesheetQueries(queryClient);
      const ts = timesheets.find((item) => item.id === id);
      if (user) await logActivity(user, 'Approved timesheet', 'Timesheet', id, `${ts?.user_name} — Week of ${ts?.week_start}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => base44.entities.Timesheet.update(id, {
      status: 'rejected',
      admin_notes: notes,
      reviewed_by: user.id,
      reviewed_by_name: user.full_name,
    }),
    onSuccess: async (_, { id }) => {
      invalidateTimesheetQueries(queryClient);
      const ts = timesheets.find((item) => item.id === id);
      if (user) await logActivity(user, 'Rejected timesheet', 'Timesheet', id, `${ts?.user_name} — ${rejectNote}`);
      setRejectDialog(null);
      setRejectNote('');
    },
  });

  const approveRevokeMutation = useMutation({
    mutationFn: (id) => base44.entities.Timesheet.update(id, { status: 'draft' }),
    onSuccess: async (_, id) => {
      invalidateTimesheetQueries(queryClient);
      const ts = timesheets.find((item) => item.id === id);
      if (user) await logActivity(user, 'Approved timesheet revocation', 'Timesheet', id, `${ts?.user_name} — Week of ${ts?.week_start}`);
    },
  });

  const declineRevokeMutation = useMutation({
    mutationFn: (id) => base44.entities.Timesheet.update(id, { status: 'approved' }),
    onSuccess: async (_, id) => {
      invalidateTimesheetQueries(queryClient);
      const ts = timesheets.find((item) => item.id === id);
      if (user) await logActivity(user, 'Declined timesheet revocation', 'Timesheet', id, `${ts?.user_name} — Week of ${ts?.week_start}`);
    },
  });

  const filtered = sortedTimesheets.filter((timesheet) => activeTab === 'all' || timesheet.status === activeTab);
  const pendingCount = timesheets.filter((timesheet) => timesheet.status === 'pending').length;
  const revokePendingCount = timesheets.filter((timesheet) => timesheet.status === 'revoke_pending').length;
  const approvedCount = timesheets.filter((timesheet) => timesheet.status === 'approved').length;
  const rejectedCount = timesheets.filter((timesheet) => timesheet.status === 'rejected').length;

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && STATUS_TABS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'pending') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  if (!isAdmin) {
    return (
      <PageShell>
        <p className="text-center text-muted-foreground">Access restricted to admins.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Timesheet Review"
        description="Open a submitted staff timesheet, review every task and hour, then approve or reject it with feedback."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Pending Review" value={pendingCount} icon={AlertCircle} tone="amber" />
        <SummaryCard label="Revoke Requests" value={revokePendingCount} icon={RotateCcw} tone="purple" />
        <SummaryCard label="Approved" value={approvedCount} icon={CheckCircle2} tone="emerald" />
        <SummaryCard label="Rejected" value={rejectedCount} icon={XCircle} tone="red" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[tab] || tab}
            {tab === 'pending' && pendingCount > 0 ? (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">{pendingCount}</span>
            ) : null}
            {tab === 'revoke_pending' && revokePendingCount > 0 ? (
              <span className="ml-2 rounded-full bg-purple-600 px-1.5 py-0.5 text-xs text-white">{revokePendingCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading ? <SectionLoader label="Loading timesheets..." /> : null}

      <div className="space-y-4">
        {filtered.map((timesheet) => {
          const entries = entriesBySheet[timesheet.id] || [];
          const isOpen = expanded === timesheet.id;
          const departmentName = resolveDepartmentName(timesheet);
          return (
            <div key={timesheet.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                className="w-full p-4 text-left transition-colors hover:bg-muted/20"
                onClick={() => setExpanded(isOpen ? null : timesheet.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {(timesheet.user_name || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">{timesheet.user_name || 'Team Member'}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {departmentName}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(timesheet.week_start).toLocaleDateString()} – {new Date(timesheet.week_end).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Number(timesheet.total_hours || 0).toFixed(1)}h
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ClipboardCheck className="h-3 w-3" />
                          {entries.length} entries
                        </span>
                        {timesheet.submitted_at ? (
                          <span>Submitted {new Date(timesheet.submitted_at).toLocaleDateString()}</span>
                        ) : null}
                      </div>
                      {timesheet.status === 'revoke_pending' && timesheet.revoke_requested_at ? (
                        <p className="mt-1.5 line-clamp-1 text-xs text-purple-700">
                          Revoke requested {new Date(timesheet.revoke_requested_at).toLocaleString()}
                        </p>
                      ) : null}
                      {timesheet.status === 'rejected' && timesheet.admin_notes ? (
                        <p className="mt-1.5 line-clamp-1 text-xs text-red-600">Rejection: {timesheet.admin_notes}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={timesheet.status} />
                    {timesheet.status === 'revoke_pending' ? (
                      <>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            approveRevokeMutation.mutate(timesheet.id);
                          }}
                          disabled={approveRevokeMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve Revoke
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={(event) => {
                            event.stopPropagation();
                            declineRevokeMutation.mutate(timesheet.id);
                          }}
                          disabled={declineRevokeMutation.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Decline
                        </Button>
                      </>
                    ) : null}
                    {timesheet.status === 'pending' ? (
                      <>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            approveMutation.mutate(timesheet.id);
                          }}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={(event) => {
                            event.stopPropagation();
                            setRejectDialog(timesheet);
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3">
                  <TimesheetEntriesPanel entries={entries} compact />
                </div>
              ) : null}
            </div>
          );
        })}

        {!filtered.length && !isLoading ? (
          <div className="rounded-xl border border-border bg-card py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
            <p className="font-semibold text-foreground">No timesheets here yet</p>
            <p className="text-sm text-muted-foreground">Submitted staff timesheets will appear here for review.</p>
          </div>
        ) : null}
      </div>

      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectNote(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="mb-3 text-sm text-muted-foreground">
              Rejecting {rejectDialog?.user_name}'s timesheet for week of {rejectDialog ? new Date(rejectDialog.week_start).toLocaleDateString() : ''}.
            </p>
            <label className="mb-1.5 block text-sm font-medium">Reason for rejection</label>
            <Textarea
              placeholder="Explain why this timesheet is being rejected..."
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectNote(''); }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => rejectMutation.mutate({ id: rejectDialog.id, notes: rejectNote })}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const colorMap = {
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorMap[tone] || colorMap.amber}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status === 'pending' ? <AlertCircle className="h-3 w-3" /> : null}
      {status === 'approved' ? <CheckCircle2 className="h-3 w-3" /> : null}
      {status === 'rejected' ? <XCircle className="h-3 w-3" /> : null}
      {status === 'draft' ? <Clock className="h-3 w-3" /> : null}
      {status === 'pending' ? 'Pending Review' : null}
      {status === 'revoke_pending' ? 'Revoke Requested' : null}
      {status === 'approved' ? 'Approved' : null}
      {status === 'rejected' ? 'Rejected' : null}
      {status === 'draft' ? 'Draft' : null}
      {!['pending', 'revoke_pending', 'approved', 'rejected', 'draft'].includes(status) ? status : null}
    </span>
  );
}