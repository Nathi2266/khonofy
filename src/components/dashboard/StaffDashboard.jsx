import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatsCard from '@/components/StatsCard';
import TaskCard from '@/components/TaskCard';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle2, AlertCircle, ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';

export default function StaffDashboard({ user }) {
  const today = new Date().toISOString().split('T')[0];

  const { data: myTasks = [] } = useQuery({
    queryKey: ['myTasks', user.id],
    queryFn: () => base44.entities.Task.filter({ assigned_to: user.id }),
    enabled: !!user.id,
  });

  const { data: todayEntries = [] } = useQuery({
    queryKey: ['todayEntries', user.id, today],
    queryFn: () => base44.entities.TimeEntry.filter({ user_id: user.id, date: today }),
    enabled: !!user.id,
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['myTimesheets', user.id],
    queryFn: () => base44.entities.Timesheet.filter({ user_id: user.id }),
    enabled: !!user.id,
  });

  const hoursToday = todayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const openTasks = myTasks.filter(t => t.status !== 'completed').length;
  const completedTasks = myTasks.filter(t => t.status === 'completed').length;
  const pendingTimesheet = timesheets.find(t => t.status === 'pending');

  return (
    <PageShell>
      <PageHeader
        title={`Good ${getGreeting()}, ${user.full_name?.split(' ')[0] || 'there'} 👋`}
        description="Here's your work summary for today."
      />

      {!user.admin_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">
              No admin has been allocated to you yet
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Your super admin has not allocated an admin to you yet. You can log time on your calendar, but you cannot submit timesheets for approval until an admin is assigned.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Hours Today" value={hoursToday.toFixed(1)} icon={Clock} color="primary" />
        <StatsCard label="Open Tasks" value={openTasks} icon={ClipboardList} color="amber" />
        <StatsCard label="Completed Tasks" value={completedTasks} icon={CheckCircle2} color="green" />
        <StatsCard
          label="Timesheet Status"
          value={pendingTimesheet ? 'Pending' : 'Up to date'}
          icon={AlertCircle}
          color={pendingTimesheet ? 'amber' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">My Active Tasks</h2>
            <Link to="/daily-log">
              <Button variant="ghost" size="sm" className="text-primary gap-1">
                Log Time <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {myTasks.filter(t => t.status !== 'completed').slice(0, 5).map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
            {myTasks.filter(t => t.status !== 'completed').length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-6">No active tasks — you're all caught up! 🎉</p>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Timesheets</h2>
            <Link to="/timesheets">
              <Button variant="ghost" size="sm" className="text-primary gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {timesheets.slice(0, 5).map(ts => (
              <div key={ts.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Week of {new Date(ts.week_start).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{ts.total_hours || 0}h logged</p>
                </div>
                <StatusBadge status={ts.status} />
              </div>
            ))}
            {timesheets.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-6">No timesheets yet. Start logging your time!</p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function StatusBadge({ status }) {
  const s = {
    draft: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${s[status] || s.draft}`}>
      {status}
    </span>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}