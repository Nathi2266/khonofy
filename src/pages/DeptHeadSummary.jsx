import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Users, Clock, Target, TrendingUp, AlertCircle } from 'lucide-react';

export default function DeptHeadSummary() {
  const { data: user } = useCurrentUser();
  const deptId = user?.department_id;

  const { data: members = [] } = useQuery({
    queryKey: ['deptUsers', deptId],
    queryFn: () => base44.entities.User.list(),
    enabled: !!deptId,
    select: (all) => all.filter(u => u.department_id === deptId),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['deptTimeEntries', deptId],
    queryFn: () => base44.entities.TimeEntry.filter({ department_id: deptId }),
    enabled: !!deptId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['deptTasks', deptId],
    queryFn: () => base44.entities.Task.filter({ department_id: deptId }),
    enabled: !!deptId,
  });

  // Per-member breakdown
  const memberStats = members.map(m => {
    const logged = timeEntries
      .filter(e => e.user_id === m.id)
      .reduce((sum, e) => sum + (e.hours || 0), 0);
    const estimated = tasks
      .filter(t => t.assigned_to === m.id && t.estimated_hours)
      .reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    return {
      name: m.full_name || m.email || 'Unknown',
      logged: Math.round(logged * 10) / 10,
      estimated: Math.round(estimated * 10) / 10,
      variance: Math.round((logged - estimated) * 10) / 10,
    };
  }).filter(m => m.logged > 0 || m.estimated > 0);

  const totalLogged = memberStats.reduce((s, m) => s + m.logged, 0);
  const totalEstimated = memberStats.reduce((s, m) => s + m.estimated, 0);
  const overBudgetCount = memberStats.filter(m => m.variance > 0 && m.estimated > 0).length;

  const canView = user?.role === 'admin' || user?.role === 'superuser';
  if (!canView) return (
    <div className="p-8 text-center text-muted-foreground">Access restricted to department heads.</div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hours vs Estimates</h1>
        <p className="text-muted-foreground text-sm mt-1">Department-wide breakdown of logged hours against task estimates</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Team Members', value: members.length, icon: Users, color: 'text-blue-500' },
          { label: 'Total Logged', value: `${totalLogged.toFixed(1)}h`, icon: Clock, color: 'text-emerald-500' },
          { label: 'Total Estimated', value: `${totalEstimated.toFixed(1)}h`, icon: Target, color: 'text-primary' },
          { label: 'Over Budget', value: overBudgetCount, icon: AlertCircle, color: 'text-amber-500' },
        ].map(card => (
          <div key={card.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <card.icon className={`w-8 h-8 ${card.color} flex-shrink-0`} />
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {memberStats.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Logged vs Estimated per Member
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={memberStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="h" />
              <Tooltip formatter={(v) => `${v}h`} />
              <Legend />
              <Bar dataKey="logged" name="Logged Hours" fill="#c10d00" radius={[4, 4, 0, 0]} />
              <Bar dataKey="estimated" name="Estimated Hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-member table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Member Breakdown</h2>
        </div>
        <div className="divide-y divide-border">
          {memberStats.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No data yet for this department.</p>
          )}
          {memberStats.map(m => {
            const pct = m.estimated > 0 ? Math.min((m.logged / m.estimated) * 100, 150) : null;
            const over = m.variance > 0 && m.estimated > 0;
            return (
              <div key={m.name} className="px-5 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-sm">{m.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{m.name}</p>
                  {pct !== null && (
                    <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden w-full max-w-xs">
                      <div
                        className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{m.logged}h logged</p>
                  <p className="text-xs text-muted-foreground">
                    {m.estimated > 0 ? `${m.estimated}h est.` : 'No estimate'}
                    {m.estimated > 0 && (
                      <span className={`ml-2 font-medium ${over ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {over ? `+${m.variance}h over` : m.variance < 0 ? `${Math.abs(m.variance)}h under` : 'on target'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}