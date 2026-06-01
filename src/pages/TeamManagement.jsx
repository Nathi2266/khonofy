import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';

export default function TeamManagement() {
  const { data: user } = useCurrentUser();

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['teamMembers', user?.department_id],
    queryFn: () => user?.department_id
      ? base44.entities.User.filter({ department_id: user.department_id })
      : base44.entities.User.list(),
    enabled: !!user,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['teamTasks', user?.department_id],
    queryFn: () => user?.department_id
      ? base44.entities.Task.filter({ department_id: user.department_id })
      : base44.entities.Task.list(),
    enabled: !!user,
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['teamTimesheets', user?.department_id],
    queryFn: () => user?.department_id
      ? base44.entities.Timesheet.filter({ department_id: user.department_id })
      : base44.entities.Timesheet.list(),
    enabled: !!user,
  });

  const getMemberStats = (memberId) => {
    const memberTasks = tasks.filter(t => t.assigned_to === memberId);
    const memberTimesheets = timesheets.filter(t => t.user_id === memberId);
    const latestSheet = memberTimesheets.sort((a, b) => new Date(b.week_start) - new Date(a.week_start))[0];
    const totalHours = memberTimesheets
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + (t.total_hours || 0), 0);
    return {
      totalTasks: memberTasks.length,
      openTasks: memberTasks.filter(t => t.status !== 'completed').length,
      completedTasks: memberTasks.filter(t => t.status === 'completed').length,
      latestSheet,
      totalHours: Math.round(totalHours),
    };
  };

  const staffMembers = teamMembers.filter(m => m.role === 'staff' || !m.role);

  return (
    <PageShell>
      <PageHeader
        title="Team Management"
        description="Overview of your team members, tasks, and timesheet statuses."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{staffMembers.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Team Members</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{tasks.filter(t => t.status !== 'completed').length}</p>
          <p className="text-sm text-muted-foreground mt-1">Open Tasks</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{timesheets.filter(t => t.status === 'pending').length}</p>
          <p className="text-sm text-muted-foreground mt-1">Pending Approvals</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-foreground">
            {tasks.length ? `${Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)}%` : '—'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Completion Rate</p>
        </div>
      </div>

      {isLoading && <p className="text-center text-muted-foreground text-sm py-8">Loading team data...</p>}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Team Members</p>
        </div>
        <div className="divide-y divide-border">
          {staffMembers.map(member => {
            const stats = getMemberStats(member.id);
            const sheetStatus = stats.latestSheet?.status;
            const sheetColors = {
              pending: 'bg-amber-100 text-amber-700',
              approved: 'bg-emerald-100 text-emerald-700',
              rejected: 'bg-red-100 text-red-600',
              draft: 'bg-slate-100 text-slate-600',
            };
            return (
              <div key={member.id} className="px-4 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-semibold">
                        {(member.full_name || member.email || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{member.full_name || 'Team Member'}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center hidden sm:block">
                      <p className="text-sm font-semibold text-foreground">{stats.openTasks}</p>
                      <p className="text-xs text-muted-foreground">Open Tasks</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-sm font-semibold text-foreground">{stats.completedTasks}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="text-center hidden md:block">
                      <p className="text-sm font-semibold text-foreground">{stats.totalHours}h</p>
                      <p className="text-xs text-muted-foreground">Approved Hrs</p>
                    </div>
                    {sheetStatus && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sheetColors[sheetStatus] || sheetColors.draft}`}>
                        {sheetStatus}
                      </span>
                    )}
                    {!stats.latestSheet && (
                      <span className="text-xs text-muted-foreground">No timesheets</span>
                    )}
                  </div>
                </div>

                {stats.totalTasks > 0 && (
                  <div className="mt-3 ml-13">
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5 transition-all"
                          style={{ width: `${stats.totalTasks ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {stats.completedTasks}/{stats.totalTasks} tasks
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {staffMembers.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground">No team members yet</p>
              <p className="text-sm text-muted-foreground">Staff members assigned to your department will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}