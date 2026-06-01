import { useMemo } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { parseDateTimeInput, toDateInputValue, toTimeInputValue } from './calendarMath';

export default function CalendarEntryModal({
  open,
  mode = 'create',
  form,
  setForm,
  tasks,
  projects,
  clients,
  tags,
  templates,
  onClose,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}) {
  const filteredTasks = useMemo(() => {
    if (!form.project_id) return tasks;
    return tasks.filter((task) => task.project_id === form.project_id);
  }, [form.project_id, tasks]);

  const handleClientChange = (clientId) => {
    const client = clients.find((item) => item.id === clientId);
    setForm((current) => ({
      ...current,
      client_id: clientId,
      client_name: client?.name || '',
      project_id: '',
      project_name: '',
    }));
  };

  const handleProjectChange = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    setForm((current) => ({
      ...current,
      project_id: projectId,
      project_name: project?.name || '',
      client_id: project?.client_id || current.client_id || '',
      client_name: project?.client_name || current.client_name || '',
      billable: project ? Boolean(project.is_billable_default) : current.billable,
      project_color: project?.color || current.project_color || '',
    }));
  };

  const handleTaskChange = (taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    setForm((current) => ({
      ...current,
      task_id: taskId,
      task_title: task?.title || current.task_title,
      project_id: task?.project_id || current.project_id,
      project_name: task?.project_name || current.project_name,
    }));
  };

  const handleTagChange = (tagId) => {
    const tag = tags.find((item) => item.id === tagId);
    setForm((current) => ({
      ...current,
      tag_id: tagId,
      tag_name: tag?.name || '',
      tag_color: tag?.color || '',
    }));
  };

  const handleDateChange = (dateValue) => {
    setForm((current) => {
      const nextStart = parseDateTimeInput(dateValue, toTimeInputValue(current.start_at));
      const nextEnd = parseDateTimeInput(dateValue, toTimeInputValue(current.end_at));
      return {
        ...current,
        start_at: nextStart,
        end_at: nextEnd <= nextStart ? new Date(nextStart.getTime() + 60 * 60 * 1000) : nextEnd,
      };
    });
  };

  const handleTimeChange = (field, timeValue) => {
    setForm((current) => {
      const dateValue = toDateInputValue(current.start_at);
      const nextTime = parseDateTimeInput(dateValue, timeValue);
      if (field === 'start_at') {
        const durationMs = current.end_at.getTime() - current.start_at.getTime();
        const adjustedEnd = new Date(nextTime.getTime() + Math.max(durationMs, 15 * 60 * 1000));
        return {
          ...current,
          start_at: nextTime,
          end_at: adjustedEnd,
        };
      }
      return {
        ...current,
        end_at: nextTime <= current.start_at ? new Date(current.start_at.getTime() + 15 * 60 * 1000) : nextTime,
      };
    });
  };

  const handleDurationChange = (hours) => {
    const value = Number(hours);
    if (!Number.isFinite(value) || value <= 0) return;
    setForm((current) => ({
      ...current,
      end_at: new Date(current.start_at.getTime() + value * 60 * 60 * 1000),
    }));
  };

  const applyTemplate = (template) => {
    setForm((current) => ({
      ...current,
      task_title: template.title,
      description: template.description || '',
      tag_id: template.tag_id || '',
      tag_name: template.tag_name || '',
      tag_color: template.tag_color || '',
      end_at: new Date(
        current.start_at.getTime() + Number(template.estimated_hours || 1) * 60 * 60 * 1000
      ),
    }));
  };

  const durationHours = Math.max(differenceInMinutes(form.end_at, form.start_at), 15) / 60;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Time Entry' : 'Create Time Entry'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {templates.length > 0 ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick templates</label>
              <div className="flex flex-wrap gap-2">
                {templates.slice(0, 6).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                  >
                    {template.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Task Name</label>
              <Input
                value={form.task_title}
                onChange={(event) => setForm((current) => ({ ...current, task_title: event.target.value, task_id: '' }))}
                placeholder="What did you work on?"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Client</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.client_id}
                onChange={(event) => handleClientChange(event.target.value)}
              >
                <option value="">No client</option>
                {clients.filter((client) => client.is_active).map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Project</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.project_id}
                onChange={(event) => handleProjectChange(event.target.value)}
              >
                <option value="">No project</option>
                {projects
                  .filter((project) => !form.client_id || project.client_id === form.client_id)
                  .map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Task</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.task_id}
                onChange={(event) => handleTaskChange(event.target.value)}
              >
                <option value="">No linked task</option>
                {filteredTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Tag</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.tag_id}
                onChange={(event) => handleTagChange(event.target.value)}
              >
                <option value="">No tag</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Date</label>
              <Input type="date" value={toDateInputValue(form.start_at)} onChange={(event) => handleDateChange(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Start Time</label>
              <Input type="time" value={toTimeInputValue(form.start_at)} onChange={(event) => handleTimeChange('start_at', event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">End Time</label>
              <Input type="time" value={toTimeInputValue(form.end_at)} onChange={(event) => handleTimeChange('end_at', event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Duration (hours)</label>
              <Input
                type="number"
                min="0.25"
                step="0.25"
                value={durationHours.toFixed(2)}
                onChange={(event) => handleDurationChange(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Billable</p>
                  <p className="text-xs text-muted-foreground">Include this entry in billable work tracking.</p>
                </div>
                <Switch
                  checked={Boolean(form.billable)}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, billable: checked }))}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Add notes for this time entry"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            {mode === 'edit' && onDelete ? (
              <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Entry'}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={onSave} disabled={isSaving || !form.task_title.trim()}>
              {isSaving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Entry'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
