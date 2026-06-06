import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';
import { Input } from '@/components/ui/input';
import TimesheetEntriesPanel from '@/components/timesheets/TimesheetEntriesPanel';
import { Search, ChevronDown, CheckCircle2, XCircle, Clock, AlertCircle, ShieldCheck, Building2 } from 'lucide-react';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'];

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
};

export default function SuperuserTimesheetFeedback() {
  const { data: user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');

  const isSuperuser = user?.role === 'superuser';

  const { data: allTimesheets = [], isLoading } = useQuery({
    queryKey: ['allTimesheets'],
    queryFn: () => base44.entities.Timesheet.list(),
    enabled: !!user && isSuperuser,
  });

  const { data: entriesBySheet = {} } = useQuery({
    queryKey: ['allEntries', 'superuser-feedback'],
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
    enabled: !!user && isSuperuser,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user && isSuperuser,
  });

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staffUsers', 'superuser-feedback'],
    queryFn: () => base44.entities.User.filter({ role: 'staff' }),
    enabled: !!user && isSuperuser,
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
    return [...allTimesheets].sort((left, right) => {
      const leftDate = new Date(left.submitted_at || left.created_date || left.week_start);
      const rightDate = new Date(right.submitted_at || right.created_date || right.week_start);
      return rightDate - leftDate;
    });
  }, [allTimesheets]);

  const filtered = sortedTimesheets.filter((timesheet) => {
    const matchesStatus = activeTab === 'all' || timesheet.status === activeTab;
    const searchValue = search.trim().toLowerCase();
    const matchesSearch = !searchValue ||
      timesheet.user_name?.toLowerCase().includes(searchValue) ||
      timesheet.reviewed_by_name?.toLowerCase().includes(searchValue) ||
      timesheet.admin_notes?.toLowerCase().includes(searchValue);
    return matchesStatus && matchesSearch;
  });

  if (!isSuperuser) {
    return (
      <PageShell>
        <p className="text-center text-muted-foreground">Access restricted to super users.</p>
      </PageShell>
    );
  }

  const pendingCount = allTimesheets.filter((timesheet) => timesheet.status === 'pending').length;
  const approvedCount = allTimesheets.filter((timesheet) => timesheet.status === 'approved').length;
  const rejectedCount = allTimesheets.filter((timesheet) => timesheet.status === 'rejected').length;

  return (
    <PageShell>
      <PageHeader
        title="Timesheet Feedback"
        description="Organization-wide visibility into who submitted timesheets, who reviewed them, and the exact work that was included."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Pending Approval" value={pendingCount} icon={AlertCircle} tone="amber" />
        <SummaryCard label="Approved" value={approvedCount} icon={CheckCircle2} tone="emerald" />
        <SummaryCard label="Rejected" value={rejectedCount} icon={XCircle} tone="red" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by staff member, reviewer, or rejection note..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <SectionLoader label="Loading timesheet feedback..." /> : null}

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
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(timesheet.user_name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="truncate text-sm font-semibold text-foreground">{timesheet.user_name || 'Unknown submitter'}</p>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {departmentName}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Number(timesheet.total_hours || 0).toFixed(1)}h
                          </span>
                          <span>Submitted: {timesheet.submitted_at ? new Date(timesheet.submitted_at).toLocaleString() : 'Not submitted'}</span>
                          <span>Reviewed by: {timesheet.reviewed_by_name || 'Awaiting admin review'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={timesheet.status} />
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3">
                  {timesheet.admin_notes ? (
                    <div className={`mb-3 rounded-lg border px-4 py-3 text-sm ${timesheet.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                      <p className="font-semibold">{timesheet.status === 'rejected' ? 'Rejection note' : 'Reviewer note'}</p>
                      <p className="mt-1">{timesheet.admin_notes}</p>
                    </div>
                  ) : null}

                  <TimesheetEntriesPanel entries={entries} compact />
                </div>
              ) : null}
            </div>
          );
        })}

        {!filtered.length && !isLoading ? (
          <div className="rounded-xl border border-border bg-card py-12 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-primary/60" />
            <p className="font-semibold text-foreground">No timesheet feedback found</p>
            <p className="text-sm text-muted-foreground">Submitted and reviewed timesheets will appear here for superuser oversight.</p>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const colorMap = {
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-600',
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
      {status === 'pending' ? 'Pending Review' : status}
    </span>
  );
}
