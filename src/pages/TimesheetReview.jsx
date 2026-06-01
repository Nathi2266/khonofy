import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, ChevronDown, Calendar } from 'lucide-react';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'];

export default function TimesheetReview() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [expanded, setExpanded] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['teamTimesheets', user?.department_id],
    queryFn: () => user?.department_id
      ? base44.entities.Timesheet.filter({ department_id: user.department_id })
      : base44.entities.Timesheet.list(),
    enabled: !!user,
  });

  const { data: entriesBySheet = {} } = useQuery({
    queryKey: ['allEntries'],
    queryFn: async () => {
      const entries = await base44.entities.TimeEntry.list();
      return entries.reduce((acc, e) => {
        if (e.timesheet_id) {
          if (!acc[e.timesheet_id]) acc[e.timesheet_id] = [];
          acc[e.timesheet_id].push(e);
        }
        return acc;
      }, {});
    },
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Timesheet.update(id, {
      status: 'approved',
      reviewed_by: user.id,
      reviewed_by_name: user.full_name,
    }),
    onSuccess: async (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['teamTimesheets'] });
      const ts = timesheets.find(t => t.id === id);
      if (user) await logActivity(user, 'Approved timesheet', 'Timesheet', id, `${ts?.user_name} — Week of ${ts?.week_start}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => base44.entities.Timesheet.update(id, {
      status: 'rejected',
      admin_notes: notes,
      reviewed_by: user.id,
      reviewed_by_name: user.full_name,
    }),
    onSuccess: async (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['teamTimesheets'] });
      const ts = timesheets.find(t => t.id === id);
      if (user) await logActivity(user, 'Rejected timesheet', 'Timesheet', id, `${ts?.user_name} — ${rejectNote}`);
      setRejectDialog(null);
      setRejectNote('');
    },
  });

  const filtered = timesheets.filter(t => activeTab === 'all' || t.status === activeTab);
  const pendingCount = timesheets.filter(t => t.status === 'pending').length;

  return (
    <PageShell>
      <PageHeader
        title="Timesheet Review"
        description="Review and approve or reject your team's timesheet submissions."
      />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'pending' && pendingCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading && <p className="text-center text-muted-foreground text-sm py-8">Loading timesheets...</p>}
      <div className="space-y-3">
        {filtered.map(ts => {
          const entries = entriesBySheet[ts.id] || [];
          const isOpen = expanded === ts.id;
          return (
            <div key={ts.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(isOpen ? null : ts.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-semibold text-sm">
                        {(ts.user_name || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{ts.user_name || 'Team Member'}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(ts.week_start).toLocaleDateString()} – {new Date(ts.week_end).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ts.total_hours || 0}h total
                        </span>
                      </div>
                      {ts.admin_notes && ts.status === 'rejected' && (
                        <p className="text-xs text-red-600 mt-1">Reason: {ts.admin_notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={ts.status} />
                    {ts.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                          onClick={(e) => { e.stopPropagation(); approveMutation.mutate(ts.id); }}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); setRejectDialog(ts); }}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </div>

              {isOpen && entries.length > 0 && (
                <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Time Entries</p>
                  <div className="space-y-1.5">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-start justify-between py-2 px-3 rounded-lg bg-background">
                        <div>
                          <p className="text-sm font-medium text-foreground">{e.task_title || 'Task'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{new Date(e.date).toLocaleDateString()}</span>
                            {e.description && <span>· {e.description}</span>}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-primary ml-4 flex-shrink-0">{e.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isOpen && entries.length === 0 && (
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  <p className="text-sm text-muted-foreground">No linked time entries found.</p>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="font-semibold text-foreground">All clear!</p>
            <p className="text-muted-foreground text-sm">No timesheets in this category.</p>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectNote(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Rejecting {rejectDialog?.user_name}'s timesheet for week of {rejectDialog && new Date(rejectDialog.week_start).toLocaleDateString()}.
            </p>
            <label className="text-sm font-medium mb-1.5 block">Reason for rejection (optional)</label>
            <Textarea
              placeholder="Explain why this timesheet is being rejected..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectNote(''); }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => rejectMutation.mutate({ id: rejectDialog.id, notes: rejectNote })}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function StatusBadge({ status }) {
  const s = {
    draft: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s[status] || s.draft}`}>
      {status}
    </span>
  );
}