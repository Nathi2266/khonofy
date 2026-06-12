import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import FormSelect from '@/components/ui/FormSelect';
import StaffMultiSelect from '@/components/ui/StaffMultiSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['todo', 'in_progress', 'completed', 'blocked'];

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};
const STATUS_COLORS = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-600',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
  status: 'todo',
  assigned_to: '',
  assigned_to_name: '',
  assigned_staff: [],
  estimated_hours: '',
  project_id: '',
  project_name: '',
};

function buildTaskPayload(form, user, { isEdit = false, assignee = null } = {}) {
  /** @type {Record<string, unknown>} */
  const payload = {
    title: form.title.trim(),
    priority: form.priority,
    status: form.status,
  };

  const description = form.description?.trim();
  if (description) payload.description = description;

  if (form.due_date) payload.due_date = form.due_date;

  const assignedTo = assignee?.id ?? form.assigned_to;
  const assignedToName = assignee?.full_name ?? form.assigned_to_name;

  if (assignedTo) {
    payload.assigned_to = assignedTo;
    payload.assigned_to_name = assignedToName || undefined;
  } else if (isEdit) {
    payload.assigned_to = null;
    payload.assigned_to_name = null;
  }

  if (form.project_id) {
    payload.project_id = form.project_id;
    payload.project_name = form.project_name || undefined;
  } else if (isEdit) {
    payload.project_id = null;
    payload.project_name = null;
  }

  if (!isEdit) {
    payload.created_by_id = user?.id;
    if (user?.department_id) payload.department_id = user.department_id;
  }

  if (form.estimated_hours !== '' && form.estimated_hours != null) {
    const hours = parseFloat(form.estimated_hours);
    if (Number.isFinite(hours)) payload.estimated_hours = hours;
  } else if (isEdit) {
    payload.estimated_hours = null;
  }

  return payload;
}

function formatHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '0';
  const rounded = Math.round(hours * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
}

export default function TaskManagement() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const canViewTeamTime = user?.role === 'admin' || user?.role === 'superuser';

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.id, user?.role],
    queryFn: () => {
      if (!user) return [];
      if (user.role === 'superuser') return base44.entities.Task.list();
      if (user.role === 'admin') return base44.entities.Task.filter({ created_by_id: user.id });
      return base44.entities.Task.filter({ created_by_id: user.id });
    },
    enabled: !!user,
  });

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staffUsers', user?.id, user?.role, user?.admin_id],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      const staff = users.filter((staffUser) => staffUser.role === 'staff');
      if (user?.role === 'admin') {
        return staff.filter((staffUser) => staffUser.admin_id === user.id);
      }
      if (user?.role === 'staff') {
        return staff.filter((staffUser) => staffUser.admin_id === user.admin_id);
      }
      return staff;
    },
    enabled: !!user,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['teamTimeEntries', user?.id, user?.role],
    queryFn: () => base44.entities.TimeEntry.list(),
    enabled: !!user && canViewTeamTime,
  });

  const taskTimeStats = useMemo(() => {
    const stats = {};
    for (const entry of timeEntries) {
      if (!entry.task_id) continue;
      if (!stats[entry.task_id]) {
        stats[entry.task_id] = { totalHours: 0, entries: [] };
      }
      stats[entry.task_id].totalHours += Number(entry.hours || 0);
      stats[entry.task_id].entries.push(entry);
    }
    for (const taskId of Object.keys(stats)) {
      stats[taskId].entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return stats;
  }, [timeEntries]);

  const canMultiAssignOnCreate = !editingTask;

  const { data: projects = [] } = useQuery({
    queryKey: ['taskProjects', user?.department_id, user?.role],
    queryFn: () => {
      if (!user) return [];
      return base44.entities.Project.list();
    },
    enabled: !!user,
  });

  const createTask = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      closeForm();
      toast({
        title: 'Task created',
        description: task.assigned_to_name
          ? `"${task.title}" was assigned to ${task.assigned_to_name}.`
          : `"${task.title}" was created successfully.`,
        centered: true,
        duration: 3000,
      });
      if (user) await logActivity(user, 'Created task', 'Task', task.id, `"${task.title}"`);
    },
    onError: (error) => {
      toast({
        title: 'Could not create task',
        description: error?.message || 'Please check the form and try again.',
        variant: 'destructive',
        centered: true,
      });
    },
  });

  const createMultipleTasks = useMutation({
    mutationFn: async (assignees) => {
      const basePayload = buildTaskPayload(
        { ...form, assigned_to: '', assigned_to_name: '' },
        user,
      );
      return Promise.all(
        assignees.map((member) =>
          base44.entities.Task.create({
            ...basePayload,
            assigned_to: member.id,
            assigned_to_name: member.full_name || undefined,
          }),
        ),
      );
    },
    onSuccess: async (tasks) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      closeForm();
      const assigneeNames = tasks.map((task) => task.assigned_to_name).filter(Boolean);
      toast({
        title: tasks.length === 1 ? 'Task created' : `${tasks.length} tasks created`,
        description: assigneeNames.length
          ? `"${form.title}" was assigned to ${assigneeNames.join(', ')}.`
          : `"${form.title}" was created successfully.`,
        centered: true,
        duration: 3000,
      });
      if (user) {
        await Promise.all(
          tasks.map((task) =>
            logActivity(user, 'Created task', 'Task', task.id, `"${task.title}"`),
          ),
        );
      }
    },
    onError: (error) => {
      toast({
        title: 'Could not create tasks',
        description: error?.message || 'Please check the form and try again.',
        variant: 'destructive',
        centered: true,
      });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      if (user) await logActivity(user, 'Updated task', 'Task', editingTask?.id, `"${form.title}"`);
      closeForm();
    },
    onError: (error) => {
      toast({
        title: 'Could not update task',
        description: error?.message || 'Please check the form and try again.',
        variant: 'destructive',
        centered: true,
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      if (user) await logActivity(user, 'Deleted task', 'Task', deletingTask?.id, `"${deletingTask?.title}"`);
      setDeletingTask(null);
    },
  });

  const openCreate = () => { setForm(EMPTY_FORM); setEditingTask(null); setShowForm(true); };
  const openEdit = (task) => {
    setForm({
      title: task.title || '',
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      assigned_to: task.assigned_to || '',
      assigned_to_name: task.assigned_to_name || '',
      assigned_staff: [],
      estimated_hours: task.estimated_hours || '',
      project_id: task.project_id || '',
      project_name: task.project_name || '',
    });
    setEditingTask(task);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingTask(null); setForm(EMPTY_FORM); };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editingTask) {
      const payload = buildTaskPayload(form, user, { isEdit: true });
      updateTask.mutate({ id: editingTask.id, data: payload });
      return;
    }
    if (!editingTask && form.assigned_staff.length > 0) {
      createMultipleTasks.mutate(form.assigned_staff);
      return;
    }
    createTask.mutate(buildTaskPayload(form, user));
  };

  const handleAssigneeChange = (userId) => {
    const member = staffUsers.find(u => u.id === userId);
    setForm({ ...form, assigned_to: userId, assigned_to_name: member?.full_name || '' });
  };

  const handleAssigneesChange = (assignees) => {
    setForm({ ...form, assigned_staff: assignees });
  };

  const handleProjectChange = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    setForm({
      ...form,
      project_id: projectId,
      project_name: project?.name || '',
    });
  };

  const filtered = tasks.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <PageShell>
      <PageHeader
        title="Task Management"
        description="Create, assign, and track tasks for your team."
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> New Task
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Task table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_108px_120px_72px] gap-3 px-4 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Task</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Time Logged</span>
          <span>Assignee</span>
          <span className="text-right">Actions</span>
        </div>
        {isLoading ? <SectionLoader label="Loading tasks..." /> : null}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <DashboardIcon src={dashboardIcon4} className={`mx-auto mb-3 opacity-40 ${DASHBOARD_ICON_SIZES.hero}`} />
            <p className="font-medium text-foreground">No tasks found</p>
            <p className="text-muted-foreground text-sm">Create your first task to get started.</p>
          </div>
        )}
        <div className="divide-y divide-border">
          {filtered.map(task => {
            const timeStats = taskTimeStats[task.id];
            const loggedHours = timeStats?.totalHours || 0;
            const estimatedHours = Number(task.estimated_hours);
            const hasEstimate = Number.isFinite(estimatedHours) && estimatedHours > 0;
            const isOverEstimate = hasEstimate && loggedHours > estimatedHours;
            const overBy = isOverEstimate ? loggedHours - estimatedHours : 0;
            const isExpanded = expandedTaskId === task.id;
            const recentEntries = timeStats?.entries || [];

            return (
              <div key={task.id} className="hover:bg-muted/20 transition-colors">
                <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_108px_120px_72px] gap-3 px-4 py-3.5 items-center">
                  <div className="min-w-0 flex items-start gap-2">
                    {recentEntries.length > 0 ? (
                      <button
                        type="button"
                        className="mt-0.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        aria-label={isExpanded ? 'Hide logged time' : 'Show logged time'}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    ) : (
                      <span className="w-4 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>}
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground mt-0.5">Due {new Date(task.due_date).toLocaleDateString()}</p>
                      )}
                      {task.project_name && (
                        <p className="text-xs text-primary mt-0.5">Project: {task.project_name}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                    {task.priority}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${STATUS_COLORS[task.status] || STATUS_COLORS.todo}`}>
                    {task.status?.replace('_', ' ')}
                  </span>
                  <div className="text-xs leading-snug">
                    <span className={isOverEstimate ? 'font-semibold text-amber-700' : 'text-foreground'}>
                      {formatHours(loggedHours)}h logged
                    </span>
                    {hasEstimate && (
                      <span className="text-muted-foreground"> / {formatHours(estimatedHours)}h est.</span>
                    )}
                    {isOverEstimate && (
                      <span className="mt-1 flex items-center gap-1 text-amber-700 font-medium">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        +{formatHours(overBy)}h over
                      </span>
                    )}
                    {!loggedHours && (
                      <span className="block text-muted-foreground mt-0.5">No time yet</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{task.assigned_to_name || '—'}</span>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(task)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeletingTask(task)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {isExpanded && recentEntries.length > 0 && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3 pl-10">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Calendar time logged ({recentEntries.length} {recentEntries.length === 1 ? 'entry' : 'entries'})
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {recentEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg bg-background px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {new Date(entry.date).toLocaleDateString()}
                              {entry.user_name ? ` · ${entry.user_name}` : ''}
                            </p>
                            <p className="text-muted-foreground mt-0.5 truncate">
                              {entry.description || 'No description'}
                            </p>
                          </div>
                          <span className="font-semibold text-foreground flex-shrink-0">{formatHours(entry.hours)}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <Input placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea placeholder="Task description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            {editingTask && canViewTeamTime && (
              (() => {
                const loggedHours = taskTimeStats[editingTask.id]?.totalHours || 0;
                const estimatedHours = Number(editingTask.estimated_hours);
                const hasEstimate = Number.isFinite(estimatedHours) && estimatedHours > 0;
                const isOverEstimate = hasEstimate && loggedHours > estimatedHours;
                return (
                  <div className={`rounded-lg border px-3 py-2 text-sm ${isOverEstimate ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-border bg-muted/30 text-foreground'}`}>
                    <p className="font-medium">
                      Staff logged {formatHours(loggedHours)}h
                      {hasEstimate ? ` of ${formatHours(estimatedHours)}h estimated` : ''}
                    </p>
                    {isOverEstimate && (
                      <p className="text-xs mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {formatHours(loggedHours - estimatedHours)}h over the estimate
                      </p>
                    )}
                    {!loggedHours && (
                      <p className="text-xs text-muted-foreground mt-1">No calendar time logged yet.</p>
                    )}
                  </div>
                );
              })()
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Priority</label>
                <FormSelect
                  value={form.priority}
                  onValueChange={(priority) => setForm({ ...form, priority })}
                  options={PRIORITIES.map((priority) => ({ value: priority, label: priority }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Status</label>
                <FormSelect
                  value={form.status}
                  onValueChange={(status) => setForm({ ...form, status })}
                  options={STATUSES.map((status) => ({
                    value: status,
                    label: status.replace('_', ' '),
                  }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Due Date</label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Est. Hours</label>
                <Input type="number" placeholder="8" min="0" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Project</label>
              <FormSelect
                value={form.project_id}
                onValueChange={handleProjectChange}
                placeholder="No project"
                options={[
                  { value: '', label: 'No project' },
                  ...projects
                    .filter((project) => project.is_active || project.id === form.project_id)
                    .map((project) => ({ value: project.id, label: project.name })),
                ]}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Assign To{canMultiAssignOnCreate ? ' (multiple)' : ''}
              </label>
              {canMultiAssignOnCreate ? (
                <StaffMultiSelect
                  options={staffUsers}
                  value={form.assigned_staff}
                  onChange={handleAssigneesChange}
                  placeholder="Unassigned (select staff)"
                />
              ) : (
                <FormSelect
                  value={form.assigned_to}
                  onValueChange={handleAssigneeChange}
                  placeholder="Unassigned"
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...staffUsers.map((staffUser) => ({
                      value: staffUser.id,
                      label: staffUser.full_name || staffUser.email,
                    })),
                  ]}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !form.title.trim()
                || createTask.isPending
                || createMultipleTasks.isPending
                || updateTask.isPending
              }
            >
              {createTask.isPending || createMultipleTasks.isPending || updateTask.isPending
                ? 'Saving...'
                : editingTask
                  ? 'Save Changes'
                  : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingTask?.title}"?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">This will permanently delete the task. Time entries logged against it will remain.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTask.mutate(deletingTask.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}