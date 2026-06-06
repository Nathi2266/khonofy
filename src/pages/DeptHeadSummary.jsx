import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Users, Clock, Target, TrendingUp, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import { toast } from '@/components/ui/use-toast';

const SUBMITTED_STATUSES = new Set(['pending', 'approved']);

export default function DeptHeadSummary() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [hourTargetInput, setHourTargetInput] = useState('');

  const { data: allUsers = [] } = useQuery({
    queryKey: ['deptUsers', user?.id],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user && (user.role === 'admin' || user.role === 'superuser'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user && isAdmin,
  });

  const members = useMemo(() => {
    if (!isAdmin) return allUsers;
    return allUsers.filter((member) => {
      if (member.role !== 'staff') return false;
      if (member.admin_id !== user.id) return false;
      if (user.department_id) return member.department_id === user.department_id;
      return true;
    });
  }, [allUsers, isAdmin, user?.id, user?.department_id]);

  const adminDepartment = useMemo(
    () => departments.find((department) => department.id === user?.department_id),
    [departments, user?.department_id]
  );

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['deptTimeEntries', user?.id],
    queryFn: () => base44.entities.TimeEntry.list(),
    enabled: !!user && (user.role === 'admin' || user.role === 'superuser'),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['deptTimesheets', user?.id],
    queryFn: () => base44.entities.Timesheet.list(),
    enabled: !!user && (user.role === 'admin' || user.role === 'superuser'),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['deptTasks', user?.id],
    queryFn: () => base44.entities.Task.list(),
    enabled: !!user && (user.role === 'admin' || user.role === 'superuser'),
  });

  const memberStats = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.id));

    return members.map((member) => {
      const logged = timeEntries
        .filter((entry) => entry.user_id === member.id)
        .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
      const submitted = timesheets
        .filter((sheet) => sheet.user_id === member.id && SUBMITTED_STATUSES.has(sheet.status))
        .reduce((sum, sheet) => sum + Number(sheet.total_hours || 0), 0);
      const estimated = tasks
        .filter((task) => task.assigned_to === member.id && task.estimated_hours)
        .reduce((sum, task) => sum + Number(task.estimated_hours || 0), 0);

      return {
        id: member.id,
        name: member.full_name || member.email || 'Unknown',
        logged: Math.round(logged * 10) / 10,
        submitted: Math.round(submitted * 10) / 10,
        estimated: Math.round(estimated * 10) / 10,
        variance: Math.round((logged - estimated) * 10) / 10,
      };
    }).filter((member) => memberIds.has(member.id) && (member.logged > 0 || member.submitted > 0 || member.estimated > 0));
  }, [members, timeEntries, timesheets, tasks]);

  const totalLogged = memberStats.reduce((sum, member) => sum + member.logged, 0);
  const totalSubmitted = memberStats.reduce((sum, member) => sum + member.submitted, 0);
  const totalEstimated = memberStats.reduce((sum, member) => sum + member.estimated, 0);
  const hourTarget = Number(adminDepartment?.weekly_hour_target || 0);
  const overBudgetCount = memberStats.filter((member) => member.variance > 0 && member.estimated > 0).length;

  const updateHourTarget = useMutation({
    mutationFn: async (weeklyHourTarget) => {
      if (!adminDepartment?.id) throw new Error('No department found for this admin.');
      return base44.entities.Department.update(adminDepartment.id, {
        weekly_hour_target: weeklyHourTarget,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: 'Time lock updated',
        description: 'Staff must meet this weekly hour target before submitting timesheets.',
        centered: true,
        duration: 3000,
      });
    },
  });

  const canView = user?.role === 'admin' || user?.role === 'superuser';
  if (!canView) {
    return (
      <div className="p-8 text-center text-muted-foreground">Access restricted to department heads.</div>
    );
  }

  const handleSaveHourTarget = () => {
    const value = hourTargetInput.trim() === '' ? null : Number(hourTargetInput);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      toast({
        title: 'Invalid time lock',
        description: 'Enter a positive number of hours or leave the field empty to remove the lock.',
        variant: 'destructive',
        centered: true,
        duration: 3000,
      });
      return;
    }
    updateHourTarget.mutate(value);
  };

  return (
    <PageShell>
      <PageHeader
        title="Hours vs Estimates"
        description="Department submitted hours, logged hours, and weekly time lock for your allocated staff."
      />

      {isAdmin && adminDepartment ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <Lock className="h-4 w-4 text-primary" />
                Weekly Time Lock
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set the minimum hours staff in {adminDepartment.name} must log before they can submit a timesheet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder={hourTarget ? String(hourTarget) : 'e.g. 40'}
                value={hourTargetInput}
                onChange={(event) => setHourTargetInput(event.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">hours</span>
              <Button onClick={handleSaveHourTarget} disabled={updateHourTarget.isPending}>
                {updateHourTarget.isPending ? 'Saving...' : 'Save Lock'}
              </Button>
            </div>
          </div>
          {hourTarget > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Current lock: staff must submit at least {hourTarget}h per week.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No time lock is currently set for this department.</p>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Team Members', value: members.length, icon: Users, color: 'text-blue-500' },
          { label: 'Total Logged', value: `${totalLogged.toFixed(1)}h`, icon: Clock, color: 'text-emerald-500' },
          { label: 'Total Submitted', value: `${totalSubmitted.toFixed(1)}h`, icon: Target, color: 'text-primary' },
          { label: 'Over Budget', value: overBudgetCount, icon: AlertCircle, color: 'text-amber-500' },
        ].map((card) => (
          <div key={card.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <card.icon className={`h-8 w-8 flex-shrink-0 ${card.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {memberStats.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Logged, Submitted, and Estimated per Member
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={memberStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="h" />
              <Tooltip formatter={(value) => `${value}h`} />
              <Legend />
              <Bar dataKey="logged" name="Logged Hours" fill="#c10d00" radius={[4, 4, 0, 0]} />
              <Bar dataKey="submitted" name="Submitted Hours" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="estimated" name="Estimated Hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-semibold text-foreground">Member Breakdown</h2>
        </div>
        <div className="divide-y divide-border">
          {memberStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data yet for your allocated staff.</p>
          ) : null}
          {memberStats.map((member) => {
            const pct = member.estimated > 0 ? Math.min((member.logged / member.estimated) * 100, 150) : null;
            const over = member.variance > 0 && member.estimated > 0;
            const meetsLock = !hourTarget || member.logged >= hourTarget;

            return (
              <div key={member.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <span className="text-sm font-bold text-primary">{member.name[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  {pct !== null ? (
                    <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex-shrink-0 space-y-0.5 text-right">
                  <p className="text-sm font-semibold text-foreground">{member.submitted}h submitted</p>
                  <p className="text-xs text-muted-foreground">{member.logged}h logged</p>
                  <p className="text-xs text-muted-foreground">
                    {member.estimated > 0 ? `${member.estimated}h est.` : 'No estimate'}
                    {hourTarget > 0 ? (
                      <span className={`ml-2 font-medium ${meetsLock ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {meetsLock ? 'meets lock' : `needs ${Math.max(hourTarget - member.logged, 0).toFixed(1)}h`}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
