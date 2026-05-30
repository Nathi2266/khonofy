import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, Activity, Filter } from 'lucide-react';

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Audit Trail
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Complete log of all user actions across the organization.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, or details..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
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

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_120px_1fr_140px] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Timestamp</span>
          <span>User</span>
          <span>Action Type</span>
          <span>Details</span>
          <span>Entity</span>
        </div>
        {isLoading && (
          <p className="text-center text-muted-foreground text-sm py-8">Loading audit log...</p>
        )}
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {filtered.map(log => (
            <div key={log.id} className="grid grid-cols-[160px_1fr_120px_1fr_140px] gap-4 px-4 py-3 items-start hover:bg-muted/20 transition-colors text-sm">
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(log.created_date).toLocaleString()}
              </span>
              <div>
                <p className="font-medium text-foreground leading-tight">{log.user_name || 'Unknown'}</p>
                {log.department_id && (
                  <p className="text-xs text-muted-foreground mt-0.5">{log.department_id}</p>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${getActionColor(log.action)}`}>
                {log.action}
              </span>
              <span className="text-muted-foreground text-xs truncate">{log.details || '—'}</span>
              <span className="text-xs text-muted-foreground">
                {log.entity_type || '—'}
                {log.entity_id && <span className="text-muted-foreground/60 ml-1 font-mono">{log.entity_id.slice(0, 8)}</span>}
              </span>
            </div>
          ))}
          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground">No activity found</p>
              <p className="text-muted-foreground text-sm">Activity will appear here as users interact with the system.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}