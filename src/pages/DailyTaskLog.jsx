import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Plus, Calendar, CheckCircle2, ChevronDown } from 'lucide-react';

const STATUS_COLORS = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-600',
};

export default function DailyTaskLog() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [selectedTask, setSelectedTask] = useState(null);
  const [logForm, setLogForm] = useState({ hours: '', description: '', date: today });
  const [expandedTask, setExpandedTask] = useState(null);

  const { data: myTasks = [], isLoading } = useQuery({
    queryKey: ['myTasks', user?.id],
    queryFn: () => base44.entities.Task.filter({ assigned_to: user.id }),
    enabled: !!user?.id,
  });

  const { data: todayEntries = [] } = useQuery({
    queryKey: ['timeEntries', user?.id, today],
    queryFn: () => base44.entities.TimeEntry.filter({ user_id: user.id, date: today }),
    enabled: !!user?.id,
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['allMyEntries', user?.id],
    queryFn: () => base44.entities.TimeEntry.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  const logTimeMutation = useMutation({
    mutationFn: (data) => base44.entities.TimeEntry.create(data),
    onSuccess: async (entry) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['allMyEntries'] });
      queryClient.invalidateQueries({ queryKey: ['todayEntries'] });
      if (user) await logActivity(user, 'Logged time', 'TimeEntry', entry.id, `${logForm.hours}h on "${selectedTask?.title}"`);
      setSelectedTask(null);
      setLogForm({ hours: '', description: '', date: today });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myTasks'] }),
  });

  const hoursToday = todayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  const handleLogTime = () => {
    if (!logForm.hours || !selectedTask) return;
    logTimeMutation.mutate({
      task_id: selectedTask.id,
      task_title: selectedTask.title,
      user_id: user.id,
      user_name: user.full_name,
      date: logForm.date,
      hours: parseFloat(logForm.hours),
      description: logForm.description,
      department_id: user.department_id || '',
    });
  };

  const activeTasks = myTasks.filter(t => t.status !== 'completed');
  const completedTasks = myTasks.filter(t => t.status === 'completed');

  if (!user) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Task Log</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-primary">{hoursToday.toFixed(1)}h</p>
          <p className="text-xs text-primary/70 font-medium">logged today</p>
        </div>
      </div>

      {/* Today's entries summary */}
      {todayEntries.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground text-sm mb-3">Today's Logged Time</h2>
          <div className="space-y-2">
            {todayEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.task_title || 'Task'}</p>
                  {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
                </div>
                <span className="text-sm font-semibold text-primary">{entry.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active tasks */}
      <div>
        <h2 className="font-semibold text-foreground mb-3">
          Active Tasks <span className="text-muted-foreground font-normal text-sm">({activeTasks.length})</span>
        </h2>
        {isLoading && <p className="text-muted-foreground text-sm text-center py-6">Loading your tasks...</p>}
        <div className="space-y-3">
          {activeTasks.map(task => {
            const taskEntries = allEntries.filter(e => e.task_id === task.id);
            const totalLogged = taskEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
            const isExpanded = expandedTask === task.id;
            return (
              <div key={task.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{task.title}</p>
                      {task.description && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status] || STATUS_COLORS.todo}`}>
                          {task.status?.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">{totalLogged}h logged</span>
                        {task.estimated_hours && (
                          <span className="text-xs text-muted-foreground">/ {task.estimated_hours}h est.</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="gap-1.5 h-8"
                        onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Log Time
                      </Button>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 bg-muted/20">
                    <div className="flex items-center gap-3 mb-3">
                      <label className="text-xs font-medium text-muted-foreground">Update Status:</label>
                      <select
                        className="text-xs border border-border rounded-md px-2 py-1 bg-background"
                        value={task.status}
                        onChange={(e) => updateTaskMutation.mutate({ id: task.id, data: { status: e.target.value } })}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                    {taskEntries.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Time History</p>
                        {taskEntries.slice(-5).map(e => (
                          <div key={e.id} className="flex justify-between text-xs py-1 px-2 rounded bg-background">
                            <span className="text-muted-foreground">{new Date(e.date).toLocaleDateString()} — {e.description || 'No note'}</span>
                            <span className="font-semibold text-foreground">{e.hours}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {activeTasks.length === 0 && !isLoading && (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-foreground">All tasks complete!</p>
              <p className="text-muted-foreground text-sm">No active tasks assigned to you.</p>
            </div>
          )}
        </div>
      </div>

      {completedTasks.length > 0 && (
        <div>
          <h2 className="font-semibold text-foreground mb-3 text-muted-foreground">
            Completed <span className="font-normal text-sm">({completedTasks.length})</span>
          </h2>
          <div className="space-y-2">
            {completedTasks.map(task => (
              <div key={task.id} className="bg-card rounded-xl border border-border p-4 opacity-60">
                <p className="text-sm font-medium text-foreground line-through">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Time Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Time — {selectedTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Date</label>
              <Input
                type="date"
                value={logForm.date}
                onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Hours Worked</label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                placeholder="e.g. 2.5"
                value={logForm.hours}
                onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Work Description</label>
              <Textarea
                placeholder="What did you work on?"
                value={logForm.description}
                onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>Cancel</Button>
            <Button
              onClick={handleLogTime}
              disabled={!logForm.hours || logTimeMutation.isPending}
            >
              {logTimeMutation.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}