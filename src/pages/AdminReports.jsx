import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import StatsCard from '@/components/StatsCard';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import dashboardIcon1 from '@/assets/images/dashboard/1.png';
import dashboardIcon3 from '@/assets/images/dashboard/3.png';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon5 from '@/assets/images/dashboard/5.png';
import dashboardIcon20 from '@/assets/images/dashboard/20.png';
import dashboardIcon19 from '@/assets/images/dashboard/19.png';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

function getWeekAgo(n = 4) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

export default function AdminReports() {
  const { data: user } = useCurrentUser();
  const [dateFrom, setDateFrom] = useState(getWeekAgo(4));
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [applied, setApplied] = useState({ from: getWeekAgo(4), to: new Date().toISOString().split('T')[0] });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const { data: allTimesheets = [] } = useQuery({
    queryKey: ['allTimesheets', user?.id, applied],
    queryFn: () => base44.entities.Timesheet.list(),
    select: (ts) => ts.filter(t => t.week_start >= applied.from && t.week_end <= applied.to),
    enabled: !!user,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['allTasks', user?.id],
    queryFn: () => base44.entities.Task.list(),
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers', user?.id],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  // Build dept hours data
  const deptHoursData = departments.map(dept => {
    const deptSheets = allTimesheets.filter(t => t.department_id === dept.id);
    const approved = deptSheets.filter(t => t.status === 'approved').reduce((s, t) => s + (t.total_hours || 0), 0);
    const pending = deptSheets.filter(t => t.status === 'pending').reduce((s, t) => s + (t.total_hours || 0), 0);
    const staff = allUsers.filter(u => u.department_id === dept.id && u.role === 'staff').length;
    return { name: dept.name, approved: Math.round(approved), pending: Math.round(pending), staff };
  });

  const totalApproved = allTimesheets.filter(t => t.status === 'approved').reduce((s, t) => s + (t.total_hours || 0), 0);
  const totalPending = allTimesheets.filter(t => t.status === 'pending').reduce((s, t) => s + (t.total_hours || 0), 0);
  const completedTasks = allTasks.filter(t => t.status === 'completed').length;
  const completionRate = allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0;

  // Weekly hours trend
  const weeklyMap = {};
  allTimesheets.forEach(t => {
    const w = t.week_start;
    if (!weeklyMap[w]) weeklyMap[w] = 0;
    weeklyMap[w] += t.total_hours || 0;
  });
  const weeklyData = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, hours]) => ({
      week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: Math.round(hours),
    }));

  return (
    <PageShell>
      <PageHeader
        title="Department Reports"
        description="Hours tracked and productivity metrics across all departments."
      />

      {/* Date range filter */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
          </div>
          <Button onClick={() => setApplied({ from: dateFrom, to: dateTo })} className="gap-2">
            <CalendarDays className="w-4 h-4" /> Apply Filter
          </Button>
          <Button variant="outline" onClick={() => {
            const f = getWeekAgo(4);
            const t = new Date().toISOString().split('T')[0];
            setDateFrom(f); setDateTo(t); setApplied({ from: f, to: t });
          }}>Reset</Button>
          <p className="text-sm text-muted-foreground ml-auto">
            Showing: {new Date(applied.from).toLocaleDateString()} – {new Date(applied.to).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Approved Hours" value={Math.round(totalApproved)} iconSrc={dashboardIcon20} color="green" />
        <StatsCard label="Pending Hours" value={Math.round(totalPending)} iconSrc={dashboardIcon3} color="amber" />
        <StatsCard label="Task Completion" value={`${completionRate}%`} iconSrc={dashboardIcon4} color="primary" />
        <StatsCard label="Active Staff" value={allUsers.filter(u => u.role === 'staff').length} iconSrc={dashboardIcon1} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dept hours bar chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <DashboardIcon src={dashboardIcon19} className={DASHBOARD_ICON_SIZES.section} />
            Hours by Department
          </h2>
          {deptHoursData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deptHoursData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={70}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="approved" name="Approved hrs" fill="hsl(173,58%,39%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending hrs" fill="hsl(43,96%,56%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No data for this period.</p>
          )}
        </div>

        {/* Weekly trend */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <DashboardIcon src={dashboardIcon5} className={DASHBOARD_ICON_SIZES.section} />
            Weekly Hours Trend
          </h2>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                <Bar dataKey="hours" name="Total hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No timesheet data yet.</p>
          )}
        </div>
      </div>

      {/* Dept breakdown table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <DashboardIcon src={dashboardIcon19} className={DASHBOARD_ICON_SIZES.section} />
          Department Breakdown
        </div>
        <div className="divide-y divide-border">
          {deptHoursData.map((dept, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3.5 items-center hover:bg-muted/20 transition-colors">
              <span className="text-sm font-medium text-foreground break-words">{dept.name}</span>
              <div className="text-center">
                <p className="font-semibold text-foreground">{dept.approved}h</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-amber-600">{dept.pending}h</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">{dept.staff}</p>
                <p className="text-xs text-muted-foreground">Staff</p>
              </div>
            </div>
          ))}
          {deptHoursData.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No departments found.</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}