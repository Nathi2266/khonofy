import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

const EMPTY_FORM = { task_id: '', task_title: '', description: '', hours: '1', tag_id: '', tag_name: '', tag_color: '' };

export default function CalendarView() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const scrollRef = useRef(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null); // { date, hour }
  const [form, setForm] = useState(EMPTY_FORM);
  const [showManualForm, setShowManualForm] = useState(false);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = weekDates[0].toISOString().split('T')[0];
  const weekEnd = weekDates[6].toISOString().split('T')[0];

  // Scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 56;
    }
  }, []);

  const { data: myTasks = [] } = useQuery({
    queryKey: ['myTasks', user?.id],
    queryFn: () => base44.entities.Task.filter({ assigned_to: user.id }),
    enabled: !!user?.id,
  });

  const { data: weekEntries = [] } = useQuery({
    queryKey: ['calendarEntries', user?.id, weekStart, weekEnd],
    queryFn: async () => {
      const entries = await base44.entities.TimeEntry.filter({ user_id: user.id });
      return entries.filter(e => e.date >= weekStart && e.date <= weekEnd);
    },
    enabled: !!user?.id,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', user?.id],
    queryFn: () => base44.entities.TaskTemplate.filter({ user_id: user.id }),
    enabled: !!user?.id,
  });

  const createEntry = useMutation({
    mutationFn: (data) => base44.entities.TimeEntry.create(data),
    onSuccess: async (entry) => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['allMyEntries'] });
      if (user) await logActivity(user, 'Logged time', 'TimeEntry', entry.id, `${form.hours}h on "${form.task_title}"`);
      setSelectedSlot(null);
      setShowManualForm(false);
      setForm(EMPTY_FORM);
    },
  });

  // Group entries by date+hour key
  const entryMap = {};
  weekEntries.forEach(e => {
    const key = `${e.date}-${e.start_hour ?? 9}`;
    if (!entryMap[key]) entryMap[key] = [];
    entryMap[key].push(e);
  });

  const openSlot = (date, hour) => {
    setForm({ ...EMPTY_FORM, hours: '1' });
    setSelectedSlot({ date: date.toISOString().split('T')[0], hour });
  };

  const handleTagChange = (tagId) => {
    const tag = tags.find(t => t.id === tagId);
    setForm({ ...form, tag_id: tagId, tag_name: tag?.name || '', tag_color: tag?.color || '' });
  };

  const handleTaskChange = (taskId) => {
    const task = myTasks.find(t => t.id === taskId);
    setForm({ ...form, task_id: taskId, task_title: task?.title || '' });
  };

  const applyTemplate = (tpl) => {
    setForm({
      ...EMPTY_FORM,
      task_title: tpl.title,
      description: tpl.description || '',
      hours: tpl.estimated_hours ? String(tpl.estimated_hours) : '1',
      tag_id: tpl.tag_id || '',
      tag_name: tpl.tag_name || '',
      tag_color: tpl.tag_color || '',
    });
  };

  const submitEntry = (slotDate, slotHour) => {
    if (!form.task_title || !form.hours) return;
    createEntry.mutate({
      task_id: form.task_id || '',
      task_title: form.task_title,
      user_id: user.id,
      user_name: user.full_name || user.email,
      date: slotDate,
      start_hour: slotHour,
      hours: parseFloat(form.hours),
      description: form.description,
      tag_id: form.tag_id,
      tag_name: form.tag_name,
      tag_color: form.tag_color,
      department_id: user.department_id || '',
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> Calendar
          </h1>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} className="h-8 px-3 text-xs">
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' – '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowManualForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Entry
        </Button>
      </div>

      {/* Templates row */}
      {templates.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2 overflow-x-auto flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">Quick templates:</span>
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => { applyTemplate(tpl); setShowManualForm(true); }}
              className="flex-shrink-0 text-xs px-3 py-1 rounded-full border border-border bg-card hover:border-primary hover:text-primary transition-colors font-medium"
            >
              {tpl.title}
            </button>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Day headers */}
        <div className="flex flex-shrink-0 border-b border-border bg-card">
          <div className="w-16 flex-shrink-0" />
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === today;
            return (
              <div key={i} className={`flex-1 text-center py-2.5 border-l border-border ${isToday ? 'bg-primary/5' : ''}`}>
                <p className="text-xs text-muted-foreground font-medium">{DAYS[i]}</p>
                <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Scrollable hour rows */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto">
          {HOURS.map(hour => (
            <div key={hour} className="flex" style={{ minHeight: '56px' }}>
              <div className="w-16 flex-shrink-0 border-r border-border flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-muted-foreground font-medium">{formatHour(hour)}</span>
              </div>
              {weekDates.map((date, di) => {
                const dateStr = date.toISOString().split('T')[0];
                const isToday = dateStr === today;
                const key = `${dateStr}-${hour}`;
                const slotEntries = entryMap[key] || [];
                return (
                  <div
                    key={di}
                    className={`flex-1 border-l border-b border-border relative cursor-pointer group transition-colors min-h-14 ${isToday ? 'bg-primary/3' : 'hover:bg-muted/40'}`}
                    style={{ minHeight: '56px' }}
                    onClick={() => openSlot(date, hour)}
                  >
                    {slotEntries.map((entry, ei) => (
                      <div
                        key={ei}
                        className="absolute inset-x-1 top-1 bottom-0 rounded text-white text-xs px-1.5 py-1 overflow-hidden"
                        style={{ backgroundColor: entry.tag_color || 'hsl(var(--primary))', minHeight: '24px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="font-semibold truncate leading-tight">{entry.task_title}</p>
                        <p className="opacity-80 text-xs">{entry.hours}h</p>
                      </div>
                    ))}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Click-slot Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Log Time — {selectedSlot && new Date(selectedSlot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {' '}at {selectedSlot && formatHour(selectedSlot.hour)}
            </DialogTitle>
          </DialogHeader>
          <EntryForm
            form={form}
            setForm={setForm}
            myTasks={myTasks}
            tags={tags}
            templates={templates}
            onTagChange={handleTagChange}
            onTaskChange={handleTaskChange}
            onApplyTemplate={applyTemplate}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSlot(null)}>Cancel</Button>
            <Button
              onClick={() => submitEntry(selectedSlot.date, selectedSlot.hour)}
              disabled={!form.task_title || !form.hours || createEntry.isPending}
            >
              {createEntry.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual form dialog */}
      <Dialog open={showManualForm} onOpenChange={() => { setShowManualForm(false); setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Time Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input type="date" value={form.date || today} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Start Time</label>
                <select className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background" value={form.start_hour ?? 9} onChange={(e) => setForm({ ...form, start_hour: parseInt(e.target.value) })}>
                  {HOURS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
              </div>
            </div>
          </div>
          <EntryForm
            form={form}
            setForm={setForm}
            myTasks={myTasks}
            tags={tags}
            templates={templates}
            onTagChange={handleTagChange}
            onTaskChange={handleTaskChange}
            onApplyTemplate={applyTemplate}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowManualForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button
              onClick={() => submitEntry(form.date || today, form.start_hour ?? 9)}
              disabled={!form.task_title || !form.hours || createEntry.isPending}
            >
              {createEntry.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryForm({ form, setForm, myTasks, tags, templates, onTagChange, onTaskChange, onApplyTemplate }) {
  return (
    <div className="space-y-3 py-1">
      {templates.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Quick Templates</label>
          <div className="flex flex-wrap gap-1.5">
            {templates.slice(0, 6).map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onApplyTemplate(tpl)}
                className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors bg-muted/40"
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Task *</label>
        <select
          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background mb-1"
          value={form.task_id}
          onChange={(e) => onTaskChange(e.target.value)}
        >
          <option value="">Select assigned task...</option>
          {myTasks.filter(t => t.status !== 'completed').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <Input
          placeholder="Or type task name"
          value={form.task_title}
          onChange={(e) => setForm({ ...form, task_title: e.target.value, task_id: '' })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Hours *</label>
          <Input type="number" step="0.5" min="0.5" max="24" placeholder="1" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Tag</label>
          <select
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background"
            value={form.tag_id}
            onChange={(e) => onTagChange(e.target.value)}
          >
            <option value="">No tag</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      {form.tag_id && (
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: form.tag_color || '#6366f1' }}>
            {form.tag_name}
          </span>
        </div>
      )}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Description</label>
        <Textarea placeholder="What did you work on?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
    </div>
  );
}