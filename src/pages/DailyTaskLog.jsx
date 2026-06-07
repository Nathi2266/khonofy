import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import FormSelect from '@/components/ui/FormSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon5 from '@/assets/images/dashboard/5.png';
import dashboardIcon11 from '@/assets/images/dashboard/11.png';
import {
  Plus, CheckCircle2, ChevronDown, Layers, Trash2
} from 'lucide-react';
import { addHours } from 'date-fns';

const STATUS_COLORS = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-600',
};

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

export default function DailyTaskLog() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  // Single task log
  const [selectedTask, setSelectedTask] = useState(null);
  const [logForm, setLogForm] = useState({ hours: '', description: '', date: today, start_time: '09:00', project_id: '', project_name: '', client_id: '', client_name: '', billable: false, tag_id: '', tag_name: '', tag_color: '', saveAsTemplate: false });
  const [expandedTask, setExpandedTask] = useState(null);

  // Bulk select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkLog, setShowBulkLog] = useState(false);
  const [bulkForm, setBulkForm] = useState({ hours: '', description: '', date: today, start_time: '09:00', project_id: '', project_name: '', client_id: '', client_name: '', billable: false, tag_id: '', tag_name: '', tag_color: '' });

  // Templates
  const [showTemplates, setShowTemplates] = useState(false);

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

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['dailyLogProjects', user?.department_id, user?.role],
    queryFn: () => {
      if (!user) return [];
      return base44.entities.Project.list();
    },
    enabled: !!user,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', user?.id],
    queryFn: () => base44.entities.TaskTemplate.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  const logTimeMutation = useMutation({
    mutationFn: (data) => base44.entities.TimeEntry.create(data),
    onSuccess: async (entry) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['allMyEntries'] });
      queryClient.invalidateQueries({ queryKey: ['todayEntries'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['weekEntries'] });
      queryClient.invalidateQueries({ queryKey: ['myTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['teamTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['allTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['pendingTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      if (user) await logActivity(user, 'Logged time', 'TimeEntry', entry.id, `${logForm.hours}h on "${selectedTask?.title}"`);
      // Save template if checked
      if (logForm.saveAsTemplate && selectedTask) {
        await base44.entities.TaskTemplate.create({
          user_id: user.id,
          title: selectedTask.title,
          description: logForm.description,
          tag_id: logForm.tag_id,
          tag_name: logForm.tag_name,
          tag_color: logForm.tag_color,
          estimated_hours: parseFloat(logForm.hours),
        });
        queryClient.invalidateQueries({ queryKey: ['templates'] });
      }
      setSelectedTask(null);
      setLogForm({ hours: '', description: '', date: today, start_time: '09:00', project_id: '', project_name: '', client_id: '', client_name: '', billable: false, tag_id: '', tag_name: '', tag_color: '', saveAsTemplate: false });
    },
  });

  const bulkLogMutation = useMutation({
    mutationFn: async (taskIds) => {
      return Promise.all(taskIds.map(taskId => {
        const task = myTasks.find(t => t.id === taskId);
        return base44.entities.TimeEntry.create({
          task_id: taskId,
          task_title: task?.title || '',
          user_id: user.id,
          user_name: user.full_name,
          date: bulkForm.date,
          start_at: `${bulkForm.date}T${bulkForm.start_time}:00`,
          end_at: addHours(new Date(`${bulkForm.date}T${bulkForm.start_time}:00`), parseFloat(bulkForm.hours)).toISOString(),
          hours: parseFloat(bulkForm.hours),
          description: bulkForm.description,
          project_id: bulkForm.project_id,
          project_name: bulkForm.project_name,
          client_id: bulkForm.client_id,
          client_name: bulkForm.client_name,
          billable: bulkForm.billable,
          tag_id: bulkForm.tag_id,
          tag_name: bulkForm.tag_name,
          tag_color: bulkForm.tag_color,
          department_id: user.department_id || '',
        });
      }));
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['allMyEntries'] });
      queryClient.invalidateQueries({ queryKey: ['todayEntries'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['weekEntries'] });
      queryClient.invalidateQueries({ queryKey: ['myTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['teamTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['allTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['pendingTimesheets'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      if (user) await logActivity(user, 'Bulk logged time', 'TimeEntry', '', `${bulkForm.hours}h × ${selectedIds.size} tasks`);
      setSelectedIds(new Set());
      setShowBulkLog(false);
      setBulkForm({ hours: '', description: '', date: today, start_time: '09:00', project_id: '', project_name: '', client_id: '', client_name: '', billable: false, tag_id: '', tag_name: '', tag_color: '' });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const hoursToday = todayEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const activeTasks = myTasks.filter(t => t.status !== 'completed');
  const completedTasks = myTasks.filter(t => t.status === 'completed');

  const handleTagChange = (tagId, isLog = true) => {
    const tag = tags.find(t => t.id === tagId);
    if (isLog) setLogForm({ ...logForm, tag_id: tagId, tag_name: tag?.name || '', tag_color: tag?.color || '' });
    else setBulkForm({ ...bulkForm, tag_id: tagId, tag_name: tag?.name || '', tag_color: tag?.color || '' });
  };

  const handleProjectChange = (projectId, isLog = true) => {
    const project = projects.find((item) => item.id === projectId);
    const nextState = {
      project_id: projectId,
      project_name: project?.name || '',
      client_id: project?.client_id || '',
      client_name: project?.client_name || '',
      billable: Boolean(project?.is_billable_default),
    };
    if (isLog) setLogForm({ ...logForm, ...nextState });
    else setBulkForm({ ...bulkForm, ...nextState });
  };

  const buildTaskProjectState = (task) => {
    const project = projects.find((item) => item.id === task?.project_id);
    return {
      project_id: task?.project_id || '',
      project_name: task?.project_name || '',
      client_id: project?.client_id || '',
      client_name: project?.client_name || '',
      billable: Boolean(project?.is_billable_default),
    };
  };

  const handleLogTime = () => {
    if (!logForm.hours || !selectedTask) return;
    const startAt = new Date(`${logForm.date}T${logForm.start_time}:00`);
    logTimeMutation.mutate({
      task_id: selectedTask.id,
      task_title: selectedTask.title,
      user_id: user.id,
      user_name: user.full_name,
      date: logForm.date,
      start_at: startAt.toISOString(),
      end_at: addHours(startAt, parseFloat(logForm.hours)).toISOString(),
      hours: parseFloat(logForm.hours),
      description: logForm.description,
      project_id: logForm.project_id,
      project_name: logForm.project_name,
      client_id: logForm.client_id,
      client_name: logForm.client_name,
      billable: logForm.billable,
      tag_id: logForm.tag_id,
      tag_name: logForm.tag_name,
      tag_color: logForm.tag_color,
      department_id: user.department_id || '',
    });
  };

  const applyTemplate = (tpl) => {
    setLogForm(f => ({
      ...f,
      description: tpl.description || '',
      hours: tpl.estimated_hours ? String(tpl.estimated_hours) : f.hours,
      project_id: tpl.project_id || '',
      project_name: tpl.project_name || '',
      client_id: tpl.client_id || '',
      client_name: tpl.client_name || '',
      billable: Boolean(tpl.billable),
      tag_id: tpl.tag_id || '',
      tag_name: tpl.tag_name || '',
      tag_color: tpl.tag_color || '',
    }));
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  if (!user) return null;

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Daily Task Log"
          description={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        />
        <div className="flex items-center gap-3 flex-shrink-0">
          {selectedIds.size > 0 && (
            <Button onClick={() => setShowBulkLog(true)} variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
              <Layers className="w-4 h-4" /> Log {selectedIds.size} Selected
            </Button>
          )}
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
            <DashboardIcon src={dashboardIcon5} className={DASHBOARD_ICON_SIZES.section} />
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{hoursToday.toFixed(1)}h</p>
              <p className="text-xs text-primary/70 font-medium">logged today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Templates section */}
      {templates.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DashboardIcon src={dashboardIcon11} className={DASHBOARD_ICON_SIZES.section} />
              Saved Templates
            </h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowTemplates(!showTemplates)}>
              {showTemplates ? 'Hide' : 'Show all'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(showTemplates ? templates : templates.slice(0, 6)).map(tpl => (
              <div key={tpl.id} className="group flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-3 pr-1 py-1 hover:border-primary transition-colors">
                <span className="text-xs font-medium text-foreground">{tpl.title}</span>
                {tpl.estimated_hours && <span className="text-xs text-muted-foreground">· {tpl.estimated_hours}h</span>}
                {tpl.tag_name && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full text-white ml-1" style={{ backgroundColor: tpl.tag_color || '#6366f1' }}>
                    {tpl.tag_name}
                  </span>
                )}
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 rounded-full ml-1"
                  onClick={() => deleteTemplateMutation.mutate(tpl.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's entries */}
      {todayEntries.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
            <DashboardIcon src={dashboardIcon5} className={DASHBOARD_ICON_SIZES.section} />
            Today's Logged Time
          </h2>
          <div className="space-y-2">
            {todayEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{entry.task_title || 'Task'}</p>
                    {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
                  </div>
                  {entry.tag_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: entry.tag_color || '#6366f1' }}>
                      {entry.tag_name}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-primary">{entry.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Select all / clear */}
      {activeTasks.length > 0 && (
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground flex-1">
            Active Tasks <span className="text-muted-foreground font-normal text-sm">({activeTasks.length})</span>
          </h2>
          <button className="text-xs text-primary hover:underline" onClick={() => setSelectedIds(new Set(activeTasks.map(t => t.id)))}>
            Select all
          </button>
          {selectedIds.size > 0 && (
            <button className="text-xs text-muted-foreground hover:underline" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Active task cards */}
      {isLoading ? <SectionLoader label="Loading your tasks..." className="py-6" /> : null}
      <div className="space-y-3">
        {activeTasks.map(task => {
          const taskEntries = allEntries.filter(e => e.task_id === task.id);
          const totalLogged = taskEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
          const isExpanded = expandedTask === task.id;
          const isChecked = selectedIds.has(task.id);
          return (
            <div key={task.id} className={`bg-card rounded-xl border transition-all overflow-hidden ${isChecked ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(task.id)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-primary border-primary' : 'border-border hover:border-primary'
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                    <p className="font-semibold text-foreground text-sm">{task.title}</p>
                    {task.description && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status] || STATUS_COLORS.todo}`}>
                        {STATUS_LABELS[task.status] || STATUS_LABELS.todo}
                      </span>
                      <span className="text-xs text-muted-foreground">{totalLogged}h logged</span>
                      {task.estimated_hours && <span className="text-xs text-muted-foreground">/ {task.estimated_hours}h est.</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" className="gap-1.5 h-8" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(task);
                      setLogForm({
                        hours: '',
                        description: '',
                        date: today,
                        start_time: '09:00',
                        ...buildTaskProjectState(task),
                        tag_id: '',
                        tag_name: '',
                        tag_color: '',
                        saveAsTemplate: false,
                      });
                    }}>
                      <Plus className="w-3.5 h-3.5" /> Log Time
                    </Button>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform cursor-pointer ${isExpanded ? 'rotate-180' : ''}`}
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border px-4 pb-4 pt-3 bg-muted/20">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-muted-foreground">Status:</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status] || STATUS_COLORS.todo}`}>
                      {STATUS_LABELS[task.status] || STATUS_LABELS.todo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Log time to move to In Progress · Submit your timesheet to complete
                    </span>
                  </div>
                  {taskEntries.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Time History</p>
                      {taskEntries.slice(-5).map(e => (
                        <div key={e.id} className="flex justify-between text-xs py-1 px-2 rounded bg-background items-center">
                          <span className="text-muted-foreground">{new Date(e.date).toLocaleDateString()} — {e.description || 'No note'}</span>
                          <div className="flex items-center gap-2">
                            {e.tag_name && (
                              <span className="px-1.5 py-0.5 rounded-full text-white text-xs" style={{ backgroundColor: e.tag_color || '#6366f1' }}>{e.tag_name}</span>
                            )}
                            <span className="font-semibold text-foreground">{e.hours}h</span>
                          </div>
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
            <DashboardIcon src={dashboardIcon4} className={`mx-auto mb-3 opacity-60 ${DASHBOARD_ICON_SIZES.hero}`} />
            <p className="font-semibold text-foreground">All tasks complete!</p>
            <p className="text-muted-foreground text-sm">No active tasks assigned to you.</p>
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div>
          <h2 className="font-semibold text-muted-foreground mb-3">Completed <span className="font-normal text-sm">({completedTasks.length})</span></h2>
          <div className="space-y-2">
            {completedTasks.map(task => (
              <div key={task.id} className="bg-card rounded-xl border border-border p-4 opacity-60">
                <p className="text-sm font-medium text-foreground line-through">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Log Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Log Time — {selectedTask?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {templates.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Quick Templates</label>
                <div className="flex flex-wrap gap-1.5">
                  {templates.slice(0, 5).map(tpl => (
                    <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors bg-muted/40">
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Date</label>
              <Input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Hours Worked</label>
                <Input type="number" step="0.5" min="0.5" max="24" placeholder="e.g. 2.5" value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Start Time</label>
                <Input type="time" value={logForm.start_time} onChange={(e) => setLogForm({ ...logForm, start_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Project</label>
                <FormSelect
                  value={logForm.project_id}
                  onValueChange={(projectId) => handleProjectChange(projectId, true)}
                  placeholder="No project"
                  options={[
                    { value: '', label: 'No project' },
                    ...projects
                      .filter((project) => project.is_active || project.id === logForm.project_id)
                      .map((project) => ({ value: project.id, label: project.name })),
                  ]}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Tag</label>
                <FormSelect
                  value={logForm.tag_id}
                  onValueChange={(tagId) => handleTagChange(tagId, true)}
                  placeholder="No tag"
                  options={[
                    { value: '', label: 'No tag' },
                    ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
                  ]}
                />
              </div>
            </div>
            {logForm.tag_id && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: logForm.tag_color || '#6366f1' }}>
                {logForm.tag_name}
              </span>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
              <Textarea placeholder="What did you work on?" value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} rows={3} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={logForm.saveAsTemplate} onChange={(e) => setLogForm({ ...logForm, saveAsTemplate: e.target.checked })} />
              <span className="text-sm text-foreground flex items-center gap-1.5">
                <DashboardIcon src={dashboardIcon11} className={DASHBOARD_ICON_SIZES.section} />
                Save as template for future use
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>Cancel</Button>
            <Button onClick={handleLogTime} disabled={!logForm.hours || logTimeMutation.isPending}>
              {logTimeMutation.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Log Dialog */}
      <Dialog open={showBulkLog} onOpenChange={() => setShowBulkLog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Bulk Log — {selectedIds.size} Tasks
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1">
            <p className="text-xs text-muted-foreground mb-3">These hours and details will be applied to all selected tasks:</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[...selectedIds].map(id => {
                const task = myTasks.find(t => t.id === id);
                return task ? (
                  <span key={id} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{task.title}</span>
                ) : null;
              })}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Date</label>
              <Input type="date" value={bulkForm.date} onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Hours (per task)</label>
                <Input type="number" step="0.5" min="0.5" placeholder="e.g. 2" value={bulkForm.hours} onChange={(e) => setBulkForm({ ...bulkForm, hours: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Start Time</label>
                <Input type="time" value={bulkForm.start_time} onChange={(e) => setBulkForm({ ...bulkForm, start_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Project</label>
                <FormSelect
                  value={bulkForm.project_id}
                  onValueChange={(projectId) => handleProjectChange(projectId, false)}
                  placeholder="No project"
                  options={[
                    { value: '', label: 'No project' },
                    ...projects
                      .filter((project) => project.is_active || project.id === bulkForm.project_id)
                      .map((project) => ({ value: project.id, label: project.name })),
                  ]}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Tag</label>
                <FormSelect
                  value={bulkForm.tag_id}
                  onValueChange={(tagId) => handleTagChange(tagId, false)}
                  placeholder="No tag"
                  options={[
                    { value: '', label: 'No tag' },
                    ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
                  ]}
                />
              </div>
            </div>
            <div className="pt-1">
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea placeholder="Work description (applies to all tasks)" value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkLog(false)}>Cancel</Button>
            <Button
              onClick={() => bulkLogMutation.mutate([...selectedIds])}
              disabled={!bulkForm.hours || bulkLogMutation.isPending}
            >
              {bulkLogMutation.isPending ? 'Logging...' : `Log ${selectedIds.size} Tasks`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}