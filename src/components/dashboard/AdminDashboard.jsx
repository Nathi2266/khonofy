import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatsCard from '@/components/StatsCard';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import { TIMESHEET_STATUS_ICONS, TIMESHEET_STATUS_STYLES } from '@/constants/dashboardIcons';
import dashboardIcon1 from '@/assets/images/dashboard/1.png';
import dashboardIcon3 from '@/assets/images/dashboard/3.png';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon10 from '@/assets/images/dashboard/10.png';
import dashboardIcon18 from '@/assets/images/dashboard/18.png';
import dashboardIcon20 from '@/assets/images/dashboard/20.png';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_LABELS = {
  pending: 'pending',
  revoke_pending: 'revoke request',
};

export default function AdminDashboard({ user }) {
  const { data: teamTasks = [] } = useQuery({
    queryKey: ['teamTasks', user.id],
    queryFn: () => base44.entities.Task.list(),
    enabled: !!user,
  });

  const { data: pendingTimesheets = [] } = useQuery({
    queryKey: ['pendingTimesheets', user.id],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'pending' }),
    enabled: !!user,
  });

  const { data: revokePendingTimesheets = [] } = useQuery({
    queryKey: ['revokePendingTimesheets', user.id],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'revoke_pending' }),
    enabled: !!user,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teamMembers', user.id],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const assignedStaff = useMemo(
    () => teamMembers.filter((m) => m.role === 'staff'),
    [teamMembers],
  );

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
    <PageShell>
      <PageHeader
        title="Team Dashboard"
        description="Overview of your team's progress and pending actions."
      />

      {assignedStaff.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <DashboardIcon src={dashboardIcon18} className={`flex-shrink-0 mt-0.5 ${DASHBOARD_ICON_SIZES.section}`} />
          <div>
            <p className="text-sm font-semibold text-blue-900">
              No staff users have been allocated to you yet
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Your super admin has not allocated any staff users to you yet. Once staff are assigned to you, you will see their tasks, timesheets, and team activity here.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard label="Team Members" value={assignedStaff.length} iconSrc={dashboardIcon1} color="primary" />
        <StatsCard label="Open Tasks" value={openTasks} iconSrc={dashboardIcon4} color="amber" />
        <StatsCard label="Pending Approvals" value={pendingTimesheets.length} iconSrc={dashboardIcon3} color="red" sub="timesheets awaiting" />
        <StatsCard label="Revoke Requests" value={revokePendingTimesheets.length} iconSrc={dashboardIcon18} color="amber" sub="need your decision" />
        <StatsCard
          label="Completion Rate"
          value={totalTasks ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '0%'}
          iconSrc={dashboardIcon20}
          color="green"
        />
      </div>

      {revokePendingTimesheets.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center gap-3">
            <DashboardIcon src={dashboardIcon18} className={DASHBOARD_ICON_SIZES.alert} />
            <div>
              <p className="text-sm font-semibold text-purple-900">
                {revokePendingTimesheets.length} revoke request{revokePendingTimesheets.length > 1 ? 's' : ''} from your team
              </p>
              <p className="text-xs text-purple-700">Staff have asked to unlock approved timesheets. Approve or decline each request.</p>
            </div>
          </div>
          <Link to="/timesheets/review?tab=revoke_pending">
            <Button size="sm" className="bg-purple-600 text-white hover:bg-purple-700">Review Revokes</Button>
          </Link>
        </div>
      )}

      {pendingTimesheets.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DashboardIcon src={dashboardIcon18} className={DASHBOARD_ICON_SIZES.alert} />
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
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <DashboardIcon src={dashboardIcon4} className={DASHBOARD_ICON_SIZES.section} />
            Task Status Breakdown
          </h2>
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
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <DashboardIcon src={dashboardIcon10} className={DASHBOARD_ICON_SIZES.section} />
              Recent Timesheet Submissions
            </h2>
            <Link to="/timesheets/review">
              <Button variant="ghost" size="sm" className="text-primary gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {[...revokePendingTimesheets, ...pendingTimesheets].slice(0, 6).map((ts) => (
              <div key={ts.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{ts.user_name || 'Team Member'}</p>
                  <p className="text-xs text-muted-foreground">
                    Week of {new Date(ts.week_start).toLocaleDateString()} · {ts.total_hours || 0}h
                  </p>
                </div>
                <TimesheetStatusBadge status={ts.status} />
              </div>
            ))}
            {pendingTimesheets.length === 0 && revokePendingTimesheets.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-6">
                All caught up! No pending approvals. ✅
              </p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function TimesheetStatusBadge({ status }) {
  const iconSrc = TIMESHEET_STATUS_ICONS[status];
  const style = TIMESHEET_STATUS_STYLES[status] || TIMESHEET_STATUS_STYLES.draft;
  const label = STATUS_LABELS[status] || status;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {iconSrc ? <DashboardIcon src={iconSrc} className={DASHBOARD_ICON_SIZES.inline} /> : null}
      {label}
    </span>
  );
}
