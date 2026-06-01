// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { addMinutes, differenceInMinutes, format, isSameDay } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import CalendarEntryModal from '@/components/calendar/CalendarEntryModal';
import CalendarWeekGrid from '@/components/calendar/CalendarWeekGrid';
import {
  HOUR_HEIGHT,
  MINUTES_IN_DAY,
  PX_PER_MINUTE,
  buildDateTime,
  getWeekRange,
  parseEntryDate,
  snapMinutes,
} from '@/components/calendar/calendarMath';

const VIEW_OPTIONS = ['Day', 'Week', 'Month'];

function toTimeEntryPayload(payload) {
  return {
    task_id: payload.task_id || '',
    task_title: payload.task_title || '',
    description: payload.description || '',
    project_id: payload.project_id || '',
    project_name: payload.project_name || '',
    client_id: payload.client_id || '',
    client_name: payload.client_name || '',
    tag_id: payload.tag_id || '',
    tag_name: payload.tag_name || '',
    tag_color: payload.tag_color || '',
    billable: Boolean(payload.billable),
    department_id: payload.department_id || '',
    user_id: payload.user_id || '',
    user_name: payload.user_name || '',
    timesheet_id: payload.timesheet_id || null,
    start_at: payload.start_at.toISOString(),
    end_at: payload.end_at.toISOString(),
  };
}

function createEntryForm(entry, user) {
  const { startAt, endAt } = entry
    ? parseEntryDate(entry)
    : {
        startAt: new Date(),
        endAt: addMinutes(new Date(), 60),
      };

  return {
    id: entry?.id || null,
    task_id: entry?.task_id || '',
    task_title: entry?.task_title || '',
    description: entry?.description || '',
    project_id: entry?.project_id || '',
    project_name: entry?.project_name || '',
    project_color: entry?.project_color || entry?.tag_color || '',
    client_id: entry?.client_id || '',
    client_name: entry?.client_name || '',
    tag_id: entry?.tag_id || '',
    tag_name: entry?.tag_name || '',
    tag_color: entry?.tag_color || '',
    billable: Boolean(entry?.billable),
    department_id: entry?.department_id || user?.department_id || '',
    user_id: entry?.user_id || user?.id || '',
    user_name: entry?.user_name || user?.full_name || user?.email || '',
    start_at: startAt,
    end_at: endAt,
  };
}

export default function CalendarView() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const scrollRef = useRef(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalState, setModalState] = useState({ open: false, mode: 'create', entryId: null });
  const [form, setForm] = useState(() => createEntryForm(null, null));
  const [previewSelection, setPreviewSelection] = useState(null);
  const [interaction, setInteraction] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { dates: weekDates, start: weekStartDate, endExclusive: weekEndExclusive } = useMemo(
    () => getWeekRange(weekOffset),
    [weekOffset]
  );
  const weekStart = format(weekStartDate, 'yyyy-MM-dd');
  const weekEnd = format(addMinutes(weekEndExclusive, -1), 'yyyy-MM-dd');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT;
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: myTasks = [] } = useQuery({
    queryKey: ['myTasks', user?.id],
    queryFn: () => base44.entities.Task.filter({ assigned_to: user.id }),
    enabled: !!user?.id,
  });

  const { data: weekEntries = [] } = useQuery({
    queryKey: ['calendarEntries', user?.id, weekStart, weekEnd],
    queryFn: () => base44.calendar.listEntries(weekStartDate.toISOString(), weekEndExclusive.toISOString(), user.id),
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

  const { data: projects = [] } = useQuery({
    queryKey: ['calendarProjects', user?.department_id, user?.role],
    queryFn: () => {
      if (!user) return [];
      if (user.role === 'superuser') return base44.entities.Project.list();
      if (user.department_id) return base44.entities.Project.filter({ department_id: user.department_id });
      return base44.entities.Project.filter({ is_active: true });
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['calendarClients'],
    queryFn: () => base44.entities.Client.list(),
    enabled: !!user,
  });

  const setCalendarEntries = (updater) => {
    queryClient.setQueryData(['calendarEntries', user?.id, weekStart, weekEnd], updater);
  };

  const buildOptimisticEntry = (payload, existingId) => {
    const hours = differenceInMinutes(payload.end_at, payload.start_at) / 60;
    return {
      id: existingId || `optimistic-${payload.start_at.toISOString()}`,
      ...payload,
      date: format(payload.start_at, 'yyyy-MM-dd'),
      start_hour: payload.start_at.getHours() + payload.start_at.getMinutes() / 60,
      hours,
      start_at: payload.start_at.toISOString(),
      end_at: payload.end_at.toISOString(),
    };
  };

  const invalidateCalendarQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
    queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    queryClient.invalidateQueries({ queryKey: ['allMyEntries'] });
    queryClient.invalidateQueries({ queryKey: ['weekEntries'] });
    queryClient.invalidateQueries({ queryKey: ['deptTimeEntries'] });
    queryClient.invalidateQueries({ queryKey: ['todayEntries'] });
  };

  const createEntry = useMutation({
    mutationFn: (payload) => base44.entities.TimeEntry.create(toTimeEntryPayload(payload)),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['calendarEntries', user?.id, weekStart, weekEnd] });
      const previousEntries = queryClient.getQueryData(['calendarEntries', user?.id, weekStart, weekEnd]) || [];
      setCalendarEntries([...previousEntries, buildOptimisticEntry(payload)]);
      return { previousEntries };
    },
    onError: (error, _payload, context) => {
      setCalendarEntries(context?.previousEntries || []);
      toast({
        title: 'Could not save entry',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: async (entry) => {
      invalidateCalendarQueries();
      if (user) {
        const hours = (differenceInMinutes(form.end_at, form.start_at) / 60).toFixed(2);
        await logActivity(user, 'Logged time', 'TimeEntry', entry.id, `${hours}h on "${form.task_title}"`);
      }
      setModalState({ open: false, mode: 'create', entryId: null });
    },
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, payload }) => base44.entities.TimeEntry.update(id, toTimeEntryPayload(payload)),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['calendarEntries', user?.id, weekStart, weekEnd] });
      const previousEntries = queryClient.getQueryData(['calendarEntries', user?.id, weekStart, weekEnd]) || [];
      setCalendarEntries(previousEntries.map((entry) => (
        entry.id === id ? buildOptimisticEntry(payload, id) : entry
      )));
      return { previousEntries };
    },
    onError: (error, _variables, context) => {
      setCalendarEntries(context?.previousEntries || []);
      toast({
        title: 'Could not update entry',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      invalidateCalendarQueries();
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id) => base44.entities.TimeEntry.delete(id),
    onSuccess: () => {
      invalidateCalendarQueries();
      setModalState({ open: false, mode: 'create', entryId: null });
    },
    onError: (error) => {
      toast({
        title: 'Could not delete entry',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!interaction) return undefined;

    const handlePointerMove = (event) => {
      const dayColumn = interaction.dayColumn;
      if (!dayColumn) return;

      const hoveredColumn = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-day-column="true"]');
      const activeColumn = hoveredColumn || dayColumn;
      const rect = activeColumn.getBoundingClientRect();
      const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const minuteValue = snapMinutes(offsetY / PX_PER_MINUTE);
      const dateKey = activeColumn.dataset.date;

      if (interaction.type === 'create') {
        const startMinutes = Math.min(interaction.startMinutes, minuteValue);
        const endMinutes = Math.max(interaction.startMinutes, minuteValue + 15);
        setPreviewSelection({
          date: interaction.dateKey,
          startMinutes,
          endMinutes,
          top: startMinutes * PX_PER_MINUTE,
          height: Math.max((endMinutes - startMinutes) * PX_PER_MINUTE, 16),
        });
        return;
      }

      if (!interaction.entry || !dateKey) return;
      const durationMinutes = differenceInMinutes(interaction.entry.endAt, interaction.entry.startAt);

      if (interaction.type === 'move') {
        const nextStartMinutes = Math.max(
          0,
          Math.min(MINUTES_IN_DAY - durationMinutes, minuteValue - interaction.offsetMinutes)
        );
        const nextStartAt = buildDateTime(dateKey, nextStartMinutes);
        const nextEndAt = addMinutes(nextStartAt, durationMinutes);
        setCalendarEntries((entries = []) => entries.map((entry) => (
          entry.id === interaction.entry.id
            ? buildOptimisticEntry({
                ...createEntryForm(interaction.entry, user),
                start_at: nextStartAt,
                end_at: nextEndAt,
              }, entry.id)
            : entry
        )));
        setInteraction((current) => ({
          ...current,
          dayColumn: activeColumn,
          dateKey,
          pendingStartAt: nextStartAt,
          pendingEndAt: nextEndAt,
        }));
        return;
      }

      if (interaction.type === 'resize') {
        const startMinutes = interaction.edge === 'start'
          ? Math.min(minuteValue, interaction.originalEndMinutes - 15)
          : interaction.originalStartMinutes;
        const endMinutes = interaction.edge === 'end'
          ? Math.max(minuteValue, interaction.originalStartMinutes + 15)
          : interaction.originalEndMinutes;
        const nextStartAt = buildDateTime(dateKey, startMinutes);
        const nextEndAt = buildDateTime(dateKey, endMinutes);
        setCalendarEntries((entries = []) => entries.map((entry) => (
          entry.id === interaction.entry.id
            ? buildOptimisticEntry({
                ...createEntryForm(interaction.entry, user),
                start_at: nextStartAt,
                end_at: nextEndAt,
              }, entry.id)
            : entry
        )));
        setInteraction((current) => ({
          ...current,
          dayColumn: activeColumn,
          dateKey,
          pendingStartAt: nextStartAt,
          pendingEndAt: nextEndAt,
        }));
      }
    };

    const handlePointerUp = () => {
      if (interaction.type === 'create') {
        if (previewSelection) {
          const startAt = buildDateTime(interaction.dateKey, previewSelection.startMinutes);
          const endAt = buildDateTime(interaction.dateKey, previewSelection.endMinutes);
          setForm(createEntryForm({
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            date: interaction.dateKey,
          }, user));
          setModalState({ open: true, mode: 'create', entryId: null });
        }
        setPreviewSelection(null);
      } else if (interaction.entry && interaction.pendingStartAt && interaction.pendingEndAt) {
        const payload = {
          ...createEntryForm(interaction.entry, user),
          start_at: interaction.pendingStartAt,
          end_at: interaction.pendingEndAt,
        };
        updateEntry.mutate({ id: interaction.entry.id, payload });
      } else {
        invalidateCalendarQueries();
      }

      setInteraction(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [interaction, previewSelection, queryClient, updateEntry, user, weekEnd, weekStart]);

  const openNewEntryModal = () => {
    const now = new Date();
    const roundedMinutes = snapMinutes(now.getHours() * 60 + now.getMinutes());
    const roundedStart = buildDateTime(format(now, 'yyyy-MM-dd'), roundedMinutes);
    setForm(createEntryForm({
      start_at: roundedStart.toISOString(),
      end_at: addMinutes(roundedStart, 60).toISOString(),
      date: format(now, 'yyyy-MM-dd'),
    }, user));
    setModalState({ open: true, mode: 'create', entryId: null });
  };

  const startCreateSelection = (event, date) => {
    if (event.button !== 0) return;
    const dayColumn = event.currentTarget;
    const rect = dayColumn.getBoundingClientRect();
    const minuteValue = snapMinutes((event.clientY - rect.top) / PX_PER_MINUTE);
    const dateKey = format(date, 'yyyy-MM-dd');
    setPreviewSelection({
      date: dateKey,
      startMinutes: minuteValue,
      endMinutes: minuteValue + 15,
      top: minuteValue * PX_PER_MINUTE,
      height: 15 * PX_PER_MINUTE,
    });
    setInteraction({
      type: 'create',
      dateKey,
      startMinutes: minuteValue,
      dayColumn,
    });
  };

  const startMoveEntry = (event, entry) => {
    const dayColumn = event.currentTarget.closest('[data-day-column="true"]');
    const rect = dayColumn?.getBoundingClientRect();
    const { startAt, endAt } = entry;
    const entryStartMinutes = startAt.getHours() * 60 + startAt.getMinutes();
    const pointerMinutes = rect ? snapMinutes((event.clientY - rect.top) / PX_PER_MINUTE) : entryStartMinutes;
    setInteraction({
      type: 'move',
      entry,
      dateKey: dayColumn?.dataset.date || format(startAt, 'yyyy-MM-dd'),
      dayColumn,
      offsetMinutes: pointerMinutes - entryStartMinutes,
      pendingStartAt: startAt,
      pendingEndAt: endAt,
    });
  };

  const startResizeEntry = (event, entry, edge) => {
    const dayColumn = event.currentTarget.closest('[data-day-column="true"]');
    const { startAt, endAt } = entry;
    setInteraction({
      type: 'resize',
      edge,
      entry,
      dateKey: dayColumn?.dataset.date || format(startAt, 'yyyy-MM-dd'),
      dayColumn,
      originalStartMinutes: startAt.getHours() * 60 + startAt.getMinutes(),
      originalEndMinutes: endAt.getHours() * 60 + endAt.getMinutes(),
      pendingStartAt: startAt,
      pendingEndAt: endAt,
    });
  };

  const openEntry = (entry) => {
    setForm(createEntryForm(entry, user));
    setModalState({ open: true, mode: 'edit', entryId: entry.id });
  };

  const saveEntry = () => {
    if (!form.task_title.trim()) return;
    const payload = {
      ...form,
      user_id: user.id,
      user_name: user.full_name || user.email,
      department_id: form.department_id || user.department_id || '',
    };

    if (modalState.mode === 'edit' && modalState.entryId) {
      updateEntry.mutate({ id: modalState.entryId, payload });
    } else {
      createEntry.mutate(payload);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageShell className="flex min-h-full flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="Calendar"
            description="Clockify-style weekly planning with drag-create, move, resize, and project-linked time entries."
          />
          <Button onClick={openNewEntryModal} className="gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekOffset((current) => current - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} className="h-9 px-3 text-xs">
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekOffset((current) => current + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="pl-2">
              <p className="text-sm font-semibold text-foreground">
                {format(weekStartDate, 'MMM d')} - {format(addMinutes(weekEndExclusive, -1), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">Monday to Sunday</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option}
                variant={option === 'Week' ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                disabled={option !== 'Week'}
                title={option === 'Week' ? 'Current view' : 'Coming soon'}
              >
                {option === 'Week' ? <CalendarDays className="h-4 w-4" /> : null}
                {option}
              </Button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1">
          <CalendarWeekGrid
            dates={weekDates}
            entries={weekEntries}
            previewSelection={previewSelection}
            currentTime={weekDates.some((date) => isSameDay(date, currentTime)) ? currentTime : null}
            onPointerDownCreate={startCreateSelection}
            onPointerDownMove={startMoveEntry}
            onPointerDownResize={startResizeEntry}
            onOpenEntry={openEntry}
          />
        </div>
      </PageShell>

      <CalendarEntryModal
        open={modalState.open}
        mode={modalState.mode}
        form={form}
        setForm={setForm}
        tasks={myTasks}
        projects={projects}
        clients={clients}
        tags={tags}
        templates={templates}
        onClose={() => setModalState({ open: false, mode: 'create', entryId: null })}
        onSave={saveEntry}
        onDelete={modalState.entryId ? () => deleteEntry.mutate(modalState.entryId) : null}
        isSaving={createEntry.isPending || updateEntry.isPending}
        isDeleting={deleteEntry.isPending}
      />
    </div>
  );
}