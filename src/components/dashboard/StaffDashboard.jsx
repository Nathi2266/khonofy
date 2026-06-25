import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatsCard from '@/components/StatsCard';
import TaskCard from '@/components/TaskCard';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import { TIMESHEET_STATUS_ICONS, TIMESHEET_STATUS_STYLES } from '@/constants/dashboardIcons';
import dashboardIcon3 from '@/assets/images/dashboard/3.png';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon5 from '@/assets/images/dashboard/5.png';
import dashboardIcon10 from '@/assets/images/dashboard/10.png';
import dashboardIcon18 from '@/assets/images/dashboard/18.png';
import dashboardIcon20 from '@/assets/images/dashboard/20.png';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import {
  findTimesheetForWeek,
  formatWeekRangeLabel,
  getWeekBounds,
} from '@/utils/weekBounds';

export default function StaffDashboard({ user }) {
  const today = new Date().toISOString().split('T')[0];
  const currentWeek = getWeekBounds(0);

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
  const currentWeekSheet = findTimesheetForWeek(timesheets, currentWeek);
  const timesheetStatus = getTimesheetStatusDisplay(timesheets, currentWeek, currentWeekSheet);
  const sortedTimesheets = [...timesheets].sort(
    (left, right) => new Date(right.week_start).getTime() - new Date(left.week_start).getTime()
  );

  return (
    <PageShell>
      <PageHeader
        title={`Good ${getGreeting()}, ${user.full_name?.split(' ')[0] || 'there'} 👋`}
        description="Here's your work summary for today."
      />

      {!user.admin_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <DashboardIcon src={dashboardIcon18} className={`flex-shrink-0 mt-0.5 ${DASHBOARD_ICON_SIZES.section}`} />
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
        <StatsCard label="Hours Today" value={hoursToday.toFixed(1)} iconSrc={dashboardIcon5} color="primary" />
        <StatsCard label="Open Tasks" value={openTasks} iconSrc={dashboardIcon4} color="amber" />
        <StatsCard label="Completed Tasks" value={completedTasks} iconSrc={dashboardIcon20} color="green" />
        <StatsCard
          label="Timesheet Status"
          value={timesheetStatus.value}
          iconSrc={timesheetStatus.iconSrc}
          color={timesheetStatus.color}
          sub={timesheetStatus.sub}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <DashboardIcon src={dashboardIcon4} className={DASHBOARD_ICON_SIZES.section} />
              My Active Tasks
            </h2>
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
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <DashboardIcon src={dashboardIcon10} className={DASHBOARD_ICON_SIZES.section} />
              Recent Timesheets
            </h2>
            <Link to="/timesheets">
              <Button variant="ghost" size="sm" className="text-primary gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {sortedTimesheets.slice(0, 5).map(ts => (
              <div key={ts.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {formatWeekRangeLabel(ts.week_start, ts.week_end)}
                    </p>
                    {currentWeekSheet?.id === ts.id ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Current week
                      </span>
                    ) : null}
                  </div>
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
  const iconSrc = TIMESHEET_STATUS_ICONS[status];
  const style = TIMESHEET_STATUS_STYLES[status] || TIMESHEET_STATUS_STYLES.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${style}`}>
      {iconSrc ? <DashboardIcon src={iconSrc} className={DASHBOARD_ICON_SIZES.inline} /> : null}
      {status === 'pending' ? 'Pending Review' : status}
    </span>
  );
}

function getTimesheetStatusDisplay(timesheets, currentWeek, currentWeekSheet) {
  const pendingSheet = timesheets.find((sheet) => sheet.status === 'pending');
  if (pendingSheet) {
    return {
      value: 'Pending review',
      color: 'amber',
      iconSrc: dashboardIcon3,
      sub: 'Awaiting admin',
    };
  }
  if (currentWeekSheet?.status === 'rejected') {
    return {
      value: 'Rejected',
      color: 'red',
      iconSrc: dashboardIcon3,
      sub: 'Action needed',
    };
  }
  if (currentWeekSheet?.status === 'approved') {
    return {
      value: 'Approved',
      color: 'green',
      iconSrc: dashboardIcon20,
      sub: 'This week locked',
    };
  }
  if (currentWeekSheet?.status === 'revoke_pending') {
    return {
      value: 'Revoke pending',
      color: 'amber',
      iconSrc: dashboardIcon3,
      sub: 'Admin deciding',
    };
  }
  return {
    value: 'This week open',
    color: 'amber',
    iconSrc: dashboardIcon10,
    sub: 'Log time & submit',
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
