import { useMemo } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Mic } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { parseDateTimeInput, toDateInputValue, toTimeInputValue } from './calendarMath';
import FormSelect from '@/components/ui/FormSelect';
import TagMultiSelect from './TagMultiSelect';
import { parseEntryTags } from '@/utils/entryTags';
import {
  WEEKDAY_OPTIONS,
  countRecurringOccurrences,
  formatRecurringSummary,
  normalizeRecurringEndDate,
} from './recurringEntryUtils';

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
  onOpenVoiceTicket,
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
    const project = projects.find((item) => item.id === task?.project_id);
    setForm((current) => ({
      ...current,
      task_id: taskId,
      task_title: task?.title || current.task_title,
      project_id: task?.project_id || current.project_id,
      project_name: task?.project_name || project?.name || current.project_name,
      project_color: project?.color || current.project_color || '',
      client_id: project?.client_id || current.client_id || '',
      client_name: project?.client_name || current.client_name || '',
      billable: project ? Boolean(project.is_billable_default) : current.billable,
    }));
  };

  const handleTagsChange = (nextTags) => {
    setForm((current) => ({
      ...current,
      tags: nextTags,
    }));
  };

  const handleDateChange = (dateValue) => {
    if (!dateValue) return;
    setForm((current) => {
      const nextStart = parseDateTimeInput(dateValue, toTimeInputValue(current.start_at));
      if (!nextStart) return current;
      const nextEnd = parseDateTimeInput(dateValue, toTimeInputValue(current.end_at));
      const resolvedEnd = nextEnd && nextEnd > nextStart
        ? nextEnd
        : new Date(nextStart.getTime() + 60 * 60 * 1000);
      return {
        ...current,
        start_at: nextStart,
        end_at: resolvedEnd,
        recurring_end_date: normalizeRecurringEndDate(nextStart, current.recurring_end_date),
      };
    });
  };

  const handleTimeChange = (field, timeValue) => {
    setForm((current) => {
      const dateValue = toDateInputValue(current.start_at);
      if (!dateValue) return current;
      const nextTime = parseDateTimeInput(dateValue, timeValue);
      if (!nextTime) return current;
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
    const templateTags = parseEntryTags(template);
    setForm((current) => ({
      ...current,
      task_title: template.title,
      description: template.description || '',
      tags: templateTags,
      end_at: new Date(
        current.start_at.getTime() + Number(template.estimated_hours || 1) * 60 * 60 * 1000
      ),
    }));
  };

  const durationHours = Number.isFinite(form.start_at?.getTime()) && Number.isFinite(form.end_at?.getTime())
    ? Math.max(differenceInMinutes(form.end_at, form.start_at), 15) / 60
    : 1;
  const isRecurring = Boolean(form.recurring_enabled);
  const recurringOccurrenceCount = isRecurring
    ? countRecurringOccurrences({
        startAt: form.start_at,
        endAt: form.end_at,
        recurringEndDate: form.recurring_end_date,
        recurringDays: form.recurring_days,
      })
    : 0;

  const toggleRecurringDay = (dayValue) => {
    setForm((current) => {
      const selected = new Set(current.recurring_days || []);
      if (selected.has(dayValue)) {
        selected.delete(dayValue);
      } else {
        selected.add(dayValue);
      }
      return {
        ...current,
        recurring_days: WEEKDAY_OPTIONS.map((option) => option.value).filter((value) => selected.has(value)),
      };
    });
  };

  const handleRecurringToggle = (enabled) => {
    setForm((current) => ({
      ...current,
      recurring_enabled: enabled,
      recurring_end_date: enabled
        ? normalizeRecurringEndDate(current.start_at, current.recurring_end_date)
        : current.recurring_end_date,
      recurring_days: enabled && !(current.recurring_days || []).length
        ? [current.start_at.getDay()]
        : current.recurring_days,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
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
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium">Task Name</label>
                {onOpenVoiceTicket ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs"
                    onClick={onOpenVoiceTicket}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    Voice ticket
                  </Button>
                ) : null}
              </div>
              <Input
                value={form.task_title}
                onChange={(event) => setForm((current) => ({ ...current, task_title: event.target.value, task_id: '' }))}
                placeholder="What did you work on?"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Client</label>
              <FormSelect
                value={form.client_id}
                onValueChange={handleClientChange}
                placeholder="No client"
                options={[
                  { value: '', label: 'No client' },
                  ...clients
                    .filter((client) => client.is_active || client.id === form.client_id)
                    .map((client) => ({ value: client.id, label: client.name })),
                ]}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Project</label>
              <FormSelect
                value={form.project_id}
                onValueChange={handleProjectChange}
                placeholder="No project"
                options={[
                  { value: '', label: 'No project' },
                  ...projects
                    .filter((project) => (project.is_active || project.id === form.project_id) && (!form.client_id || project.client_id === form.client_id))
                    .map((project) => ({ value: project.id, label: project.name })),
                ]}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Task</label>
              <FormSelect
                value={form.task_id}
                onValueChange={handleTaskChange}
                placeholder="No linked task"
                options={[
                  { value: '', label: 'No linked task' },
                  ...filteredTasks.map((task) => ({ value: task.id, label: task.title })),
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Tags</label>
              <TagMultiSelect
                tags={tags}
                value={form.tags || []}
                onChange={handleTagsChange}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Select existing tags, type to search, or add your own custom tags.
              </p>
            </div>

            <div className={isRecurring && mode === 'create' ? 'hidden' : ''}>
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

            {mode === 'create' ? (
              <div className="md:col-span-2 space-y-3 rounded-lg border border-border px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Recurring entry</p>
                    <p className="text-xs text-muted-foreground">
                      Repeat this entry on selected days between a start and end date.
                    </p>
                  </div>
                  <Switch
                    checked={isRecurring}
                    onCheckedChange={handleRecurringToggle}
                  />
                </div>

                {isRecurring ? (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Repeat from</label>
                        <Input
                          type="date"
                          value={toDateInputValue(form.start_at)}
                          onChange={(event) => handleDateChange(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">Repeat until</label>
                        <Input
                          type="date"
                          min={toDateInputValue(form.start_at)}
                          value={toDateInputValue(form.recurring_end_date || form.start_at)}
                          onChange={(event) => {
                            const nextEnd = parseDateTimeInput(event.target.value, '00:00');
                            if (!nextEnd) return;
                            setForm((current) => ({
                              ...current,
                              recurring_end_date: normalizeRecurringEndDate(current.start_at, nextEnd),
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Repeat on</label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map((option) => {
                          const selected = (form.recurring_days || []).includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={selected}
                              title={option.fullLabel}
                              onClick={() => toggleRecurringDay(option.value)}
                              className={`min-w-[44px] rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                                selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-foreground hover:border-primary/60'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {recurringOccurrenceCount > 0
                        ? formatRecurringSummary({
                            startAt: form.start_at,
                            recurringEndDate: form.recurring_end_date,
                            recurringDays: form.recurring_days,
                            occurrenceCount: recurringOccurrenceCount,
                          })
                        : 'Select at least one day and make sure the end date is on or after the start date.'}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
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
            <Button
              onClick={onSave}
              disabled={
                isSaving
                || !form.task_title.trim()
                || (isRecurring && recurringOccurrenceCount === 0)
              }
            >
              {isSaving
                ? 'Saving...'
                : mode === 'edit'
                  ? 'Save Changes'
                  : isRecurring
                    ? `Create ${recurringOccurrenceCount} Entries`
                    : 'Create Entry'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
