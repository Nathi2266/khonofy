import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatsCard from '@/components/StatsCard';
import { Link } from 'react-router-dom';
import { Users, Building2, Clock, AlertCircle, ArrowRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['hsl(238,68%,55%)', 'hsl(173,58%,39%)', 'hsl(43,96%,56%)', 'hsl(0,84%,60%)'];

export default function SuperuserDashboard({ user }) {
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });
  const { data: allTasks = [] } = useQuery({
    queryKey: ['allTasks'],
    queryFn: () => base44.entities.Task.list(),
  });
  const { data: pendingTimesheets = [] } = useQuery({
    queryKey: ['pendingTimesheets'],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'pending' }),
  });
  const { data: allTimesheets = [] } = useQuery({
    queryKey: ['allTimesheets'],
    queryFn: () => base44.entities.Timesheet.list(),
  });
  const { data: recentLogs = [] } = useQuery({
    queryKey: ['recentLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 10),
  });

  const totalHours = allTimesheets
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + (t.total_hours || 0), 0);

  const taskStatusData = [
    { name: 'To Do', value: allTasks.filter(t => t.status === 'todo').length },
    { name: 'In Progress', value: allTasks.filter(t => t.status === 'in_progress').length },
    { name: 'Completed', value: allTasks.filter(t => t.status === 'completed').length },
    { name: 'Blocked', value: allTasks.filter(t => t.status === 'blocked').length },
  ].filter(d => d.value > 0);

  const deptData = departments.map(dept => ({
    name: dept.name.length > 10 ? dept.name.slice(0, 10) + '…' : dept.name,
    tasks: allTasks.filter(t => t.department_id === dept.id).length,
    staff: allUsers.filter(u => u.department_id === dept.id).length,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Global Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Organization-wide overview of tasks, teams, and productivity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Staff" value={allUsers.filter(u => u.role === 'staff').length} icon={Users} color="primary" />
        <StatsCard label="Departments" value={departments.length} icon={Building2} color="purple" />
        <StatsCard label="Approved Hours" value={Math.round(totalHours)} icon={Clock} color="green" sub="total approved" />
        <StatsCard label="Pending Approvals" value={pendingTimesheets.length} icon={AlertCircle} color="red" />
      </div>

      {pendingTimesheets.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-semibold text-red-900">
              {pendingTimesheets.length} timesheet{pendingTimesheets.length > 1 ? 's' : ''} across all teams are awaiting approval
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Tasks &amp; Staff by Department</h2>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                <Bar dataKey="tasks" name="Tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="staff" name="Staff" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No department data yet.</p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Task Status Distribution</h2>
          {taskStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                  {taskStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No task data yet.</p>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Recent Activity
          </h2>
          <Link to="/audit-trail">
            <Button variant="ghost" size="sm" className="text-primary gap-1">
              Full Audit Trail <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
        <div className="space-y-1">
          {recentLogs.map(log => (
            <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              <p className="text-sm text-foreground flex-1 min-w-0 truncate">
                <span className="font-medium">{log.user_name}</span>
                <span className="text-muted-foreground"> — {log.action}</span>
                {log.details && <span className="text-muted-foreground text-xs ml-1">· {log.details}</span>}
              </p>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(log.created_date).toLocaleString()}
              </span>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">No activity recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}