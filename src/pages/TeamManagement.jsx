import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import StatsCard from '@/components/StatsCard';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import { TIMESHEET_STATUS_ICONS, TIMESHEET_STATUS_STYLES } from '@/constants/dashboardIcons';
import dashboardIcon1 from '@/assets/images/dashboard/1.png';
import dashboardIcon3 from '@/assets/images/dashboard/3.png';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon20 from '@/assets/images/dashboard/20.png';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';

export default function TeamManagement() {
  const { data: user } = useCurrentUser();

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['teamMembers', user?.id],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['teamTasks', user?.id],
    queryFn: () => base44.entities.Task.list(),
    enabled: !!user,
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['teamTimesheets', user?.id],
    queryFn: () => base44.entities.Timesheet.list(),
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
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <PageShell>
      <PageHeader
        title="Team Management"
        description="Overview of your team members, tasks, and timesheet statuses."
        iconSrc={dashboardIcon1}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Team Members" value={staffMembers.length} iconSrc={dashboardIcon1} color="primary" />
        <StatsCard label="Open Tasks" value={tasks.filter(t => t.status !== 'completed').length} iconSrc={dashboardIcon4} color="amber" />
        <StatsCard label="Pending Approvals" value={timesheets.filter(t => t.status === 'pending').length} iconSrc={dashboardIcon3} color="red" />
        <StatsCard
          label="Completion Rate"
          value={tasks.length ? `${Math.round((completedTasks / tasks.length) * 100)}%` : '—'}
          iconSrc={dashboardIcon20}
          color="green"
        />
      </div>

      {isLoading ? <SectionLoader label="Loading team data..." /> : null}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <DashboardIcon src={dashboardIcon1} className={DASHBOARD_ICON_SIZES.section} />
            Team Members
          </p>
        </div>
        <div className="divide-y divide-border">
          {staffMembers.map(member => {
            const stats = getMemberStats(member.id);
            const sheetStatus = stats.latestSheet?.status;
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
                    {sheetStatus && <TimesheetStatusBadge status={sheetStatus} />}
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
              <DashboardIcon src={dashboardIcon1} className={`mx-auto mb-3 opacity-40 ${DASHBOARD_ICON_SIZES.hero}`} />
              <p className="font-medium text-foreground">No team members yet</p>
              <p className="text-sm text-muted-foreground">Staff members allocated to you by the super admin will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function TimesheetStatusBadge({ status }) {
  const iconSrc = TIMESHEET_STATUS_ICONS[status];
  const style = TIMESHEET_STATUS_STYLES[status] || TIMESHEET_STATUS_STYLES.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {iconSrc ? <DashboardIcon src={iconSrc} className={DASHBOARD_ICON_SIZES.inline} /> : null}
      {status}
    </span>
  );
}
