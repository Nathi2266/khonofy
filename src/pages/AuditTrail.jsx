import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import dashboardIcon17 from '@/assets/images/dashboard/17.png';
import dashboardIcon20 from '@/assets/images/dashboard/20.png';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';

const ACTION_COLORS = {
  'Created task': 'bg-blue-100 text-blue-700',
  'Updated task': 'bg-slate-100 text-slate-600',
  'Deleted task': 'bg-red-100 text-red-600',
  'Logged time': 'bg-emerald-100 text-emerald-700',
  'Submitted timesheet': 'bg-amber-100 text-amber-700',
  'Approved timesheet': 'bg-emerald-100 text-emerald-700',
  'Rejected timesheet': 'bg-red-100 text-red-600',
  'Updated profile': 'bg-purple-100 text-purple-700',
};

function getActionColor(action) {
  for (const [key, val] of Object.entries(ACTION_COLORS)) {
    if (action?.includes(key)) return val;
  }
  return 'bg-slate-100 text-slate-600';
}

function getActionIcon(action) {
  if (action?.toLowerCase().includes('approv')) return dashboardIcon20;
  return dashboardIcon17;
}

export default function AuditTrail() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 200),
  });

  const entityTypes = ['all', ...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase());
    const matchEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    return matchSearch && matchEntity;
  });

  return (
    <PageShell className="flex min-h-[calc(100dvh-2rem)] flex-col gap-6">
      <PageHeader
        title="Audit Trail"
        description="Complete log of all user actions across the organization."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, or details..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            {entityTypes.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-muted-foreground">{filtered.length} records</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[160px_minmax(140px,1fr)_140px_minmax(220px,2fr)_140px] gap-4 border-b border-border bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Timestamp</span>
          <span>User</span>
          <span>Action Type</span>
          <span>Details</span>
          <span>Entity</span>
        </div>
        {isLoading ? <SectionLoader label="Loading audit log..." /> : null}
        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {filtered.map(log => (
            <div
              key={log.id}
              className="grid grid-cols-[160px_minmax(140px,1fr)_140px_minmax(220px,2fr)_140px] items-start gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/20"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(log.created_date).toLocaleString()}
              </span>
              <div className="flex min-w-0 items-start gap-2">
                <DashboardIcon src={getActionIcon(log.action)} className={`mt-0.5 ${DASHBOARD_ICON_SIZES.inline}`} />
                <div className="min-w-0">
                <p className="font-medium leading-tight text-foreground">{log.user_name || 'Unknown'}</p>
                {log.department_id ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{log.department_id}</p>
                ) : null}
                </div>
              </div>
              <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}>
                {log.action}
              </span>
              <span className="break-words text-xs text-muted-foreground">{log.details || '—'}</span>
              <span className="text-xs text-muted-foreground">
                {log.entity_type || '—'}
                {log.entity_id ? (
                  <span className="ml-1 font-mono text-muted-foreground/60">{log.entity_id.slice(0, 8)}</span>
                ) : null}
              </span>
            </div>
          ))}
          {filtered.length === 0 && !isLoading ? (
            <div className="py-12 text-center">
              <DashboardIcon src={dashboardIcon17} className={`mx-auto mb-3 opacity-40 ${DASHBOARD_ICON_SIZES.hero}`} />
              <p className="font-medium text-foreground">No activity found</p>
              <p className="text-sm text-muted-foreground">Activity will appear here as users interact with the system.</p>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
