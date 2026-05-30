import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, CheckSquare } from 'lucide-react';

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

const EMPTY_FORM = { title: '', description: '', due_date: '', priority: 'medium', status: 'todo', assigned_to: '', assigned_to_name: '', estimated_hours: '' };

export default function TaskManagement() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', user?.id, user?.department_id],
    queryFn: () => {
      if (!user) return [];
      if (user.role === 'superuser') return base44.entities.Task.list();
      if (user.department_id) return base44.entities.Task.filter({ department_id: user.department_id });
      return base44.entities.Task.filter({ created_by_id: user.id });
    },
    enabled: !!user,
  });

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staffUsers', user?.department_id],
    queryFn: () => user?.department_id
      ? base44.entities.User.filter({ department_id: user.department_id })
      : base44.entities.User.list(),
    enabled: !!user,
  });

  const createTask = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: async (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (user) await logActivity(user, 'Created task', 'Task', task.id, `"${task.title}"`);
      closeForm();
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (user) await logActivity(user, 'Updated task', 'Task', editingTask?.id, `"${form.title}"`);
      closeForm();
    },
  });

  const deleteTask = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
      estimated_hours: task.estimated_hours || '',
    });
    setEditingTask(task);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingTask(null); setForm(EMPTY_FORM); };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const payload = {
      ...form,
      department_id: user?.department_id || '',
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : undefined,
    };
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, data: payload });
    } else {
      createTask.mutate(payload);
    }
  };

  const handleAssigneeChange = (userId) => {
    const member = staffUsers.find(u => u.id === userId);
    setForm({ ...form, assigned_to: userId, assigned_to_name: member?.full_name || '' });
  };

  const filtered = tasks.filter(t => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Task Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, assign, and track tasks for your team.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

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
        <div className="grid grid-cols-[1fr_100px_100px_120px_80px] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Task</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Assignee</span>
          <span className="text-right">Actions</span>
        </div>
        {isLoading && (
          <p className="text-center text-muted-foreground text-sm py-8">Loading tasks...</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <CheckSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-foreground">No tasks found</p>
            <p className="text-muted-foreground text-sm">Create your first task to get started.</p>
          </div>
        )}
        <div className="divide-y divide-border">
          {filtered.map(task => (
            <div key={task.id} className="grid grid-cols-[1fr_100px_100px_120px_80px] gap-4 px-4 py-3.5 items-center hover:bg-muted/20 transition-colors">
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
                {task.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>}
                {task.due_date && (
                  <p className="text-xs text-muted-foreground mt-0.5">Due {new Date(task.due_date).toLocaleDateString()}</p>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                {task.priority}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${STATUS_COLORS[task.status] || STATUS_COLORS.todo}`}>
                {task.status?.replace('_', ' ')}
              </span>
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
          ))}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-md">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Priority</label>
                <select className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Status</label>
                <select className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
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
              <label className="text-sm font-medium mb-1.5 block">Assign To</label>
              <select className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background" value={form.assigned_to} onChange={(e) => handleAssigneeChange(e.target.value)}>
                <option value="">Unassigned</option>
                {staffUsers.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.title.trim() || createTask.isPending || updateTask.isPending}>
              {createTask.isPending || updateTask.isPending ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
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
    </div>
  );
}