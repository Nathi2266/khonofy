import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Building2,
  ArrowRight,
  Activity,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import dashboardIcon1 from '@/assets/images/dashboard/1.png';
import dashboardIcon2 from '@/assets/images/dashboard/2.png';
import dashboardIcon3 from '@/assets/images/dashboard/3.png';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon20 from '@/assets/images/dashboard/20.png';
import dashboardIcon11 from '@/assets/images/dashboard/11.png';
import dashboardIcon12 from '@/assets/images/dashboard/12.png';
import dashboardIcon13 from '@/assets/images/dashboard/13.png';
import dashboardIcon16 from '@/assets/images/dashboard/16.png';
import dashboardIcon17 from '@/assets/images/dashboard/17.png';
import dashboardIcon18 from '@/assets/images/dashboard/18.png';
import dashboardIcon19 from '@/assets/images/dashboard/19.png';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['hsl(238,68%,55%)', 'hsl(173,58%,39%)', 'hsl(43,96%,56%)', 'hsl(0,84%,60%)'];

const KPI_TONES = {
  primary: {
    bar: '#2563eb',
    tint: 'border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
    ring: 'border-blue-200/80 dark:border-blue-900/50',
  },
  green: {
    bar: '#059669',
    tint: 'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    ring: 'border-emerald-200/80 dark:border-emerald-900/50',
  },
  amber: {
    bar: '#d97706',
    tint: 'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
    ring: 'border-amber-200/80 dark:border-amber-900/50',
  },
  red: {
    bar: '#dc2626',
    tint: 'border border-red-100 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
    ring: 'border-red-200/80 dark:border-red-900/50',
  },
  purple: {
    bar: '#7c3aed',
    tint: 'border border-purple-100 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300',
    ring: 'border-purple-200/80 dark:border-purple-900/50',
  },
  slate: {
    bar: '#475569',
    tint: 'border border-border bg-muted/40 text-foreground dark:bg-muted/30 dark:text-muted-foreground',
    ring: 'border-border',
  },
};

function getRecordDate(record) {
  const raw = record?.created_date || record?.created_at || record?.updated_date || record?.updated_at || record?.date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDayKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function buildDailySeries(items, days, valueGetter = () => 1) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const keys = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - index));
    return toDayKey(date);
  });
  const totals = Object.fromEntries(keys.map((key) => [key, 0]));

  items.forEach((item) => {
    const date = getRecordDate(item);
    if (!date) return;
    const key = toDayKey(date);
    if (!(key in totals)) return;
    totals[key] += Number(valueGetter(item) || 0);
  });

  return keys.map((key) => totals[key]);
}

function getTrendLabel(series) {
  if (!series.length) return { label: 'No activity yet', positive: true };
  const half = Math.ceil(series.length / 2);
  const recent = series.slice(-half).reduce((sum, value) => sum + value, 0);
  const previous = series.slice(0, series.length - half).reduce((sum, value) => sum + value, 0);
  if (previous === 0 && recent === 0) return { label: '0% this week', positive: true };
  if (previous === 0) return { label: 'New this week', positive: true };
  const change = ((recent - previous) / previous) * 100;
  const rounded = Math.abs(change).toFixed(change >= 10 ? 0 : 1);
  return {
    label: `${change >= 0 ? '+' : '-'}${rounded}% this week`,
    positive: change >= 0,
  };
}

function MiniSparkline({ data, tone = 'primary' }) {
  if (!data || data.length < 2) return null;
  const width = 120;
  const height = 36;
  const padding = 3;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / (data.length - 1);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y]) => `${x},${y}`).join(' ');
  const toneColor = KPI_TONES[tone]?.bar || KPI_TONES.primary.bar;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-28 shrink-0" aria-hidden="true">
      <polyline
        fill="none"
        stroke={toneColor}
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={linePath}
      />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.6" fill={toneColor} />
    </svg>
  );
}

function KpiCard({ label, value, icon: Icon, iconSrc, series, tone = 'primary', trend, note, featured = false }) {
  const theme = KPI_TONES[tone] || KPI_TONES.primary;
  const TrendIcon = trend?.positive ? TrendingUp : TrendingDown;

  return (
    <div
      className={`group rounded-2xl border border-border bg-card p-5 text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${featured ? 'bg-gradient-to-br from-card via-background to-muted/30' : theme.ring}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${featured ? 'border border-border bg-muted/50 text-muted-foreground' : theme.tint}`}>
            {!iconSrc && Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {label}
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value ?? '—'}</p>
          {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
        </div>
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl ${iconSrc ? `${DASHBOARD_ICON_SIZES.kpi} bg-transparent` : 'h-11 w-11'} ${!iconSrc && (featured ? 'bg-primary/10 text-primary' : theme.tint)}`}>
          {iconSrc ? <DashboardIcon src={iconSrc} className={DASHBOARD_ICON_SIZES.kpi} /> : Icon ? <Icon className="h-5 w-5" /> : null}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <MiniSparkline data={series} tone={tone} />
        {trend ? (
          <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${featured ? 'border-border bg-muted/50 text-foreground' : trend.positive ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300' : 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trend.label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, iconSrc, title, description, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          {iconSrc ? (
            <DashboardIcon src={iconSrc} className={DASHBOARD_ICON_SIZES.section} />
          ) : (
            <Icon className="h-4.5 w-4.5 text-primary" />
          )}
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function SuperuserDashboard() {
  const [departmentSearch, setDepartmentSearch] = useState('');
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
  const { data: allProjects = [] } = useQuery({
    queryKey: ['allProjects'],
    queryFn: () => base44.entities.Project.list(),
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
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 12),
  });

  const staffUsers = useMemo(() => allUsers.filter((userItem) => userItem.role === 'staff'), [allUsers]);
  const activeProjects = useMemo(() => allProjects.filter((project) => project.is_active), [allProjects]);
  const blockedTasks = useMemo(() => allTasks.filter((task) => task.status === 'blocked'), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter((task) => task.status === 'completed'), [allTasks]);
  const totalHours = useMemo(
    () => allTimesheets
      .filter((timesheet) => timesheet.status === 'approved')
      .reduce((sum, timesheet) => sum + (timesheet.total_hours || 0), 0),
    [allTimesheets],
  );

  const taskStatusData = useMemo(() => ([
    { name: 'To Do', value: allTasks.filter((task) => task.status === 'todo').length },
    { name: 'In Progress', value: allTasks.filter((task) => task.status === 'in_progress').length },
    { name: 'Completed', value: completedTasks.length },
    { name: 'Blocked', value: blockedTasks.length },
  ].filter((item) => item.value > 0)), [allTasks, blockedTasks.length, completedTasks.length]);

  const departmentRows = useMemo(() => departments
    .map((dept) => ({
      id: dept.id,
      name: dept.name || 'Unnamed department',
      tasks: allTasks.filter((task) => task.department_id === dept.id).length,
      staff: allUsers.filter((userItem) => userItem.department_id === dept.id).length,
    }))
    .sort((left, right) => right.tasks - left.tasks || right.staff - left.staff || left.name.localeCompare(right.name)), [allTasks, allUsers, departments]);

  const departmentChartData = useMemo(() => {
    const topDepartments = departmentRows.slice(0, 10);
    const otherDepartments = departmentRows.slice(10);
    if (!otherDepartments.length) return topDepartments;

    const otherTotals = otherDepartments.reduce((acc, department) => {
      acc.tasks += department.tasks;
      acc.staff += department.staff;
      return acc;
    }, { tasks: 0, staff: 0 });

    return [
      ...topDepartments,
      {
        id: 'other-departments',
        name: 'Other departments',
        tasks: otherTotals.tasks,
        staff: otherTotals.staff,
      },
    ];
  }, [departmentRows]);

  const filteredDepartmentRows = useMemo(() => {
    const query = departmentSearch.trim().toLowerCase();
    if (!query) return departmentRows;
    return departmentRows.filter((department) => department.name.toLowerCase().includes(query));
  }, [departmentRows, departmentSearch]);

  const staffSeries = useMemo(() => buildDailySeries(staffUsers, 14), [staffUsers]);
  const projectSeries = useMemo(() => buildDailySeries(activeProjects, 14), [activeProjects]);
  const approvalsSeries = useMemo(() => buildDailySeries(pendingTimesheets, 14), [pendingTimesheets]);
  const hoursSeries = useMemo(
    () => buildDailySeries(
      allTimesheets.filter((timesheet) => timesheet.status === 'approved'),
      14,
      (timesheet) => Number(timesheet.total_hours || 0),
    ),
    [allTimesheets],
  );
  const activitySeries = useMemo(() => buildDailySeries(recentLogs, 14), [recentLogs]);

  const staffTrend = useMemo(() => getTrendLabel(staffSeries), [staffSeries]);
  const projectTrend = useMemo(() => getTrendLabel(projectSeries), [projectSeries]);
  const approvalsTrend = useMemo(() => getTrendLabel(approvalsSeries), [approvalsSeries]);
  const hoursTrend = useMemo(() => getTrendLabel(hoursSeries), [hoursSeries]);
  const activityTrend = useMemo(() => getTrendLabel(activitySeries), [activitySeries]);

  const liveSummary = useMemo(() => [
    { label: 'Blocked tasks', value: blockedTasks.length, tone: blockedTasks.length > 0 ? 'red' : 'green', iconSrc: dashboardIcon13 },
    { label: 'Pending approvals', value: pendingTimesheets.length, tone: pendingTimesheets.length > 0 ? 'amber' : 'green', iconSrc: dashboardIcon3 },
    { label: 'Active projects', value: activeProjects.length, tone: 'primary', iconSrc: dashboardIcon4 },
    { label: 'Recent events', value: recentLogs.length, tone: 'purple', iconSrc: dashboardIcon16 },
  ], [activeProjects.length, blockedTasks.length, pendingTimesheets.length, recentLogs.length]);

  const quickActions = [
    { label: 'Manage Users', to: '/users', description: 'Create and assign accounts', iconSrc: dashboardIcon1 },
    { label: 'Review Timesheets', to: '/timesheets/review', description: 'Approve pending work', iconSrc: dashboardIcon20 },
    { label: 'Open Reports', to: '/admin-reports', description: 'Export and inspect KPIs', iconSrc: dashboardIcon11 },
    { label: 'Audit Trail', to: '/audit-trail', description: 'See governance activity', iconSrc: dashboardIcon12 },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Super User Dashboard"
        description="Organization-wide overview of tasks, teams, productivity, and operational health."
      />

      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-background to-muted/30 px-6 py-6 text-foreground shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Staff', value: staffUsers.length, iconSrc: dashboardIcon1 },
            { label: 'Projects', value: allProjects.length, iconSrc: dashboardIcon2 },
            { label: 'Pending', value: pendingTimesheets.length, iconSrc: dashboardIcon3 },
            { label: 'Activity', value: recentLogs.length, iconSrc: dashboardIcon4 },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center rounded-2xl border border-border bg-card px-3 py-3 text-center shadow-sm">
              <DashboardIcon src={item.iconSrc} className={`mb-2 ${DASHBOARD_ICON_SIZES.hero}`} />
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <KpiCard
            featured
            label="Approved Hours"
            value={`${Math.round(totalHours)}h`}
            iconSrc={dashboardIcon20}
            tone="primary"
            trend={hoursTrend}
            note="Total approved time across the organization."
            series={hoursSeries}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-6">
          <KpiCard
            label="Total Staff"
            value={staffUsers.length}
            iconSrc={dashboardIcon1}
            tone="green"
            trend={staffTrend}
            note="Active staff members in the system."
            series={staffSeries}
          />
          <KpiCard
            label="Active Projects"
            value={activeProjects.length}
            iconSrc={dashboardIcon2}
            tone="purple"
            trend={projectTrend}
            note="Projects currently available to teams."
            series={projectSeries}
          />
          <KpiCard
            label="Pending Approvals"
            value={pendingTimesheets.length}
            iconSrc={dashboardIcon3}
            tone="amber"
            trend={approvalsTrend}
            note="Timesheets awaiting review."
            series={approvalsSeries}
          />
          <KpiCard
            label="Departments"
            value={departments.length}
            icon={Building2}
            tone="slate"
            trend={activityTrend}
            note="Organizational units currently configured."
            series={activitySeries}
          />
        </div>
      </div>

      {pendingTimesheets.length > 0 && (
        <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-amber-200/80 bg-card px-4 py-4 shadow-sm dark:border-amber-900/40 dark:bg-card">
          <div className="flex items-start gap-3">
            <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-transparent ${DASHBOARD_ICON_SIZES.alert}`}>
              <DashboardIcon src={dashboardIcon18} className={DASHBOARD_ICON_SIZES.alert} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {pendingTimesheets.length} timesheet{pendingTimesheets.length > 1 ? 's' : ''} are waiting for approval
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep an eye on approvals to maintain flow across the teams.
              </p>
            </div>
          </div>
          <Link to="/timesheets/review">
            <Button size="sm">
              Review
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <SectionHeader
              icon={Sparkles}
              title="Quick Actions"
              description="Fast paths to the most common administrative tasks."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5 hover:shadow-sm"
                >
                  <div className={`flex shrink-0 items-center justify-center rounded-2xl transition-colors ${action.iconSrc ? `${DASHBOARD_ICON_SIZES.kpi} bg-transparent` : 'h-11 w-11 bg-primary/10 text-primary group-hover:bg-primary/15'}`}>
                    {action.iconSrc ? (
                      <DashboardIcon src={action.iconSrc} className={DASHBOARD_ICON_SIZES.kpi} />
                    ) : (
                      <action.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{action.label}</p>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
            <SectionHeader
              icon={Activity}
              title="What’s Happening Now"
              description="Live operational signals and the most recent work activity."
              action={(
                <Link to="/audit-trail">
                  <Button variant="ghost" size="sm" className="gap-1 text-primary">
                    Full Audit Trail <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {liveSummary.map((item) => (
                <div key={item.label} className={`rounded-2xl px-4 py-3 ${KPI_TONES[item.tone]?.tint || KPI_TONES.slate.tint} ${item.iconSrc ? 'flex flex-col items-center text-center' : ''}`}>
                  {item.iconSrc ? <DashboardIcon src={item.iconSrc} className={`mb-2 ${DASHBOARD_ICON_SIZES.hero}`} /> : null}
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-border pt-5">
              {recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40">
                      <div className={`mt-0.5 flex shrink-0 items-center justify-center rounded-2xl bg-transparent ${DASHBOARD_ICON_SIZES.inline}`}>
                        <DashboardIcon src={dashboardIcon17} className={DASHBOARD_ICON_SIZES.inline} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-medium text-foreground">{log.user_name || 'Team member'}</p>
                          <span className="text-sm text-muted-foreground">· {log.action}</span>
                          {log.details ? <span className="text-xs text-muted-foreground">· {log.details}</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(log.created_date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No recent activity"
                  description="New actions, approvals, and updates will appear here as the organization starts moving."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <SectionHeader
            iconSrc={dashboardIcon19}
            title="Tasks &amp; Staff by Department"
            description="Top department workload with a full searchable breakdown below."
          />
          {departmentChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={departmentChartData} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.45} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '14px', fontSize: '13px' }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="tasks" name="Tasks" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={14} />
                <Bar dataKey="staff" name="Staff" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Building2}
              title="No department data yet"
              description="Once teams are populated, this chart will show department workload and staff distribution."
            />
          )}

          <div className="mt-6 border-t border-border pt-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Department breakdown</p>
                <p className="text-xs text-muted-foreground">Search the full list below for exact department counts.</p>
              </div>
              <div className="w-full sm:w-72">
                <Input
                  type="search"
                  placeholder="Search departments..."
                  value={departmentSearch}
                  onChange={(event) => setDepartmentSearch(event.target.value)}
                />
              </div>
            </div>

            {filteredDepartmentRows.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <div className="grid grid-cols-[1fr_96px_96px] gap-3 border-b border-border bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Department</span>
                  <span className="text-right">Tasks</span>
                  <span className="text-right">Staff</span>
                </div>
                <div className="max-h-[290px] divide-y divide-border overflow-y-auto">
                  {filteredDepartmentRows.map((department) => (
                    <div key={department.id} className="grid grid-cols-[1fr_96px_96px] gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">{department.name}</span>
                      <span className="text-right text-sm text-muted-foreground">{department.tasks}</span>
                      <span className="text-right text-sm text-muted-foreground">{department.staff}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Building2}
                title="No departments match your search"
                description="Try a different department name to narrow the list."
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <SectionHeader
            iconSrc={dashboardIcon4}
            title="Task Status Distribution"
            description="A quick read on how work is moving through the workflow."
          />
          {taskStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={68} outerRadius={98} dataKey="value" paddingAngle={3}>
                  {taskStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '14px', fontSize: '13px' }} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No task data yet"
              description="Task status distribution will appear here once teams begin creating work."
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}