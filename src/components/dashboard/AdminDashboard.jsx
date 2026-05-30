import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatsCard from '@/components/StatsCard';
import { Link } from 'react-router-dom';
import { Users, CheckSquare, Clock, TrendingUp, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard({ user }) {
  const { data: teamTasks = [] } = useQuery({
    queryKey: ['teamTasks', user.department_id],
    queryFn: () => user.department_id
      ? base44.entities.Task.filter({ department_id: user.department_id })
      : base44.entities.Task.list(),
    enabled: !!user,
  });

  const { data: pendingTimesheets = [] } = useQuery({
    queryKey: ['pendingTimesheets', user.department_id],
    queryFn: () => user.department_id
      ? base44.entities.Timesheet.filter({ department_id: user.department_id, status: 'pending' })
      : base44.entities.Timesheet.filter({ status: 'pending' }),
    enabled: !!user,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teamMembers', user.department_id],
    queryFn: () => user.department_id
      ? base44.entities.User.filter({ department_id: user.department_id })
      : base44.entities.User.list(),
    enabled: !!user,
  });

  const openTasks = teamTasks.filter(t => t.status !== 'completed').length;
  const completedTasks = teamTasks.filter(t => t.status === 'completed').length;
  const totalTasks = teamTasks.length;

  const taskStatusData = [
    { name: 'To Do', count: teamTasks.filter(t => t.status === 'todo').length },
    { name: 'In Progress', count: teamTasks.filter(t => t.status === 'in_progress').length },
    { name: 'Completed', count: completedTasks },
    { name: 'Blocked', count: teamTasks.filter(t => t.status === 'blocked').length },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Overview of your team's progress and pending actions.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Team Members" value={teamMembers.length} icon={Users} color="primary" />
        <StatsCard label="Open Tasks" value={openTasks} icon={CheckSquare} color="amber" />
        <StatsCard label="Pending Approvals" value={pendingTimesheets.length} icon={Clock} color="red" sub="timesheets awaiting" />
        <StatsCard
          label="Completion Rate"
          value={totalTasks ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '0%'}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {pendingTimesheets.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {pendingTimesheets.length} timesheet{pendingTimesheets.length > 1 ? 's' : ''} awaiting your approval
              </p>
              <p className="text-xs text-amber-700">Review and approve or reject submissions from your team.</p>
            </div>
          </div>
          <Link to="/timesheets/review">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">Review Now</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Task Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={taskStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Timesheet Submissions</h2>
            <Link to="/timesheets/review">
              <Button variant="ghost" size="sm" className="text-primary gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {pendingTimesheets.slice(0, 6).map(ts => (
              <div key={ts.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{ts.user_name || 'Team Member'}</p>
                  <p className="text-xs text-muted-foreground">
                    Week of {new Date(ts.week_start).toLocaleDateString()} · {ts.total_hours || 0}h
                  </p>
                </div>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  pending
                </span>
              </div>
            ))}
            {pendingTimesheets.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-6">
                All caught up! No pending approvals. ✅
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}