import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import PageShell from '@/components/PageShell';
import PageHeader from '@/components/PageHeader';
import SectionLoader from '@/components/SectionLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, FolderKanban, Pencil, Plus, Clock, Users } from 'lucide-react';

const EMPTY_CLIENT_FORM = { name: '', description: '', is_active: true };
const EMPTY_PROJECT_FORM = {
  name: '',
  description: '',
  client_id: '',
  department_id: '',
  color: '#6366f1',
  is_billable_default: false,
  is_active: true,
};

function parseBulkNames(value) {
  const seen = new Set();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildApprovedProjectStats(timeEntries, approvedTimesheets) {
  const approvedTimesheetIds = new Set(
    approvedTimesheets
      .filter((sheet) => sheet.status === 'approved' || sheet.status === 'revoke_pending')
      .map((sheet) => sheet.id)
  );

  const statsByProject = {};

  for (const entry of timeEntries) {
    if (!entry.project_id) continue;
    if (!entry.timesheet_id || !approvedTimesheetIds.has(entry.timesheet_id)) continue;

    const hours = Number(entry.hours || 0);
    if (!statsByProject[entry.project_id]) {
      statsByProject[entry.project_id] = { totalHours: 0, membersById: new Map() };
    }

    const projectStats = statsByProject[entry.project_id];
    projectStats.totalHours += hours;

    const memberId = entry.user_id || entry.user_name || 'unknown';
    const existing = projectStats.membersById.get(memberId);
    if (existing) {
      existing.hours += hours;
      if (!existing.userName && entry.user_name) existing.userName = entry.user_name;
    } else {
      projectStats.membersById.set(memberId, {
        userId: entry.user_id || memberId,
        userName: entry.user_name || 'Unknown',
        hours,
      });
    }
  }

  return Object.fromEntries(
    Object.entries(statsByProject).map(([projectId, stats]) => [
      projectId,
      {
        totalHours: stats.totalHours,
        members: [...stats.membersById.values()].sort((left, right) => right.hours - left.hours),
      },
    ])
  );
}

function ProjectApprovedHoursWidget({ stats, loading }) {
  if (loading) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        Loading approved hours...
      </div>
    );
  }

  if (!stats || stats.totalHours <= 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>No approved timesheet hours yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Approved hours
        </div>
        <span className="text-lg font-bold text-primary">{stats.totalHours.toFixed(1)}h</span>
      </div>

      {stats.members.length > 0 ? (
        <div className="mt-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Staff on this project
          </div>
          <div className="space-y-1.5">
            {stats.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">{member.userName}</span>
                <span className="font-semibold text-primary">{member.hours.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EntitySection({ title, description, icon: Icon, children, action }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function ProjectManagement() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isSuperuser = user?.role === 'superuser';
  const isAdmin = user?.role === 'admin';
  const canManage = isSuperuser || isAdmin;

  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [bulkClientText, setBulkClientText] = useState('');
  const [bulkProjectText, setBulkProjectText] = useState('');

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
    enabled: canManage,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', user?.department_id, user?.role],
    queryFn: () => {
      if (!user) return [];
      return base44.entities.Project.list();
    },
    enabled: canManage,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: canManage,
  });

  const { data: timeEntries = [], isLoading: approvedEntriesLoading } = useQuery({
    queryKey: ['projectApprovedStats', 'entries', user?.id, user?.role],
    queryFn: () => base44.entities.TimeEntry.list(),
    enabled: canManage,
  });

  const { data: approvedTimesheets = [], isLoading: approvedTimesheetsLoading } = useQuery({
    queryKey: ['projectApprovedStats', 'timesheets', user?.id, user?.role],
    queryFn: () => base44.entities.Timesheet.list(),
    enabled: canManage,
  });

  const approvedStatsByProject = useMemo(
    () => buildApprovedProjectStats(timeEntries, approvedTimesheets),
    [timeEntries, approvedTimesheets]
  );

  const approvedHoursLoading = approvedEntriesLoading || approvedTimesheetsLoading;

  const activeClientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const createClient = useMutation({
    mutationFn: (payload) => base44.entities.Client.create(payload),
    onSuccess: async (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (user) await logActivity(user, 'Created client', 'Client', client.id, client.name);
      closeClientDialog();
    },
  });

  const updateClient = useMutation({
    mutationFn: ({ id, payload }) => base44.entities.Client.update(id, payload),
    onSuccess: async (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['calendarClients'] });
      if (user) await logActivity(user, 'Updated client', 'Client', client.id, client.name);
      closeClientDialog();
    },
  });

  const createProject = useMutation({
    mutationFn: (payload) => base44.entities.Project.create(payload),
    onSuccess: async (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['taskProjects'] });
      queryClient.invalidateQueries({ queryKey: ['dailyLogProjects'] });
      queryClient.invalidateQueries({ queryKey: ['calendarProjects'] });
      if (user) await logActivity(user, 'Created project', 'Project', project.id, project.name);
      closeProjectDialog();
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, payload }) => base44.entities.Project.update(id, payload),
    onSuccess: async (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['taskProjects'] });
      queryClient.invalidateQueries({ queryKey: ['dailyLogProjects'] });
      queryClient.invalidateQueries({ queryKey: ['calendarProjects'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      if (user) await logActivity(user, 'Updated project', 'Project', project.id, project.name);
      closeProjectDialog();
    },
  });

  const bulkCreateClients = useMutation({
    mutationFn: async (names) => {
      await Promise.all(names.map((name) => base44.entities.Client.create({ name, is_active: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowBulkClientDialog(false);
      setBulkClientText('');
    },
  });

  const bulkCreateProjects = useMutation({
    mutationFn: async ({ names, clientId }) => {
      const client = activeClientMap.get(clientId);
      await Promise.all(
        names.map((name) =>
          base44.entities.Project.create({
            name,
            client_id: clientId || '',
            client_name: client?.name || '',
            department_id: user?.department_id || '',
            is_active: true,
            is_billable_default: false,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowBulkProjectDialog(false);
      setBulkProjectText('');
    },
  });

  if (!canManage) {
    return (
      <PageShell>
        <p className="text-center text-muted-foreground">Access restricted to admins and super users.</p>
      </PageShell>
    );
  }

  const handleCreateClient = () => {
    if (!clientForm.name.trim()) return;
    const payload = {
      ...clientForm,
      name: clientForm.name.trim(),
      description: clientForm.description.trim(),
    };
    if (editingClient) {
      updateClient.mutate({ id: editingClient.id, payload });
      return;
    }
    createClient.mutate(payload);
  };

  const handleCreateProject = () => {
    if (!projectForm.name.trim()) return;
    const selectedClient = clients.find((client) => client.id === projectForm.client_id);
    const payload = {
      ...projectForm,
      name: projectForm.name.trim(),
      description: projectForm.description.trim(),
      client_name: selectedClient?.name || '',
      department_id: projectForm.department_id || user?.department_id || '',
    };
    if (editingProject) {
      updateProject.mutate({ id: editingProject.id, payload });
      return;
    }
    createProject.mutate(payload);
  };

  const bulkClientNames = parseBulkNames(bulkClientText);
  const bulkProjectNames = parseBulkNames(bulkProjectText);

  function openCreateClientDialog() {
    setEditingClient(null);
    setClientForm(EMPTY_CLIENT_FORM);
    setShowClientDialog(true);
  }

  function openEditClientDialog(client) {
    setEditingClient(client);
    setClientForm({
      name: client.name || '',
      description: client.description || '',
      is_active: Boolean(client.is_active),
    });
    setShowClientDialog(true);
  }

  function closeClientDialog() {
    setShowClientDialog(false);
    setEditingClient(null);
    setClientForm(EMPTY_CLIENT_FORM);
  }

  function openCreateProjectDialog() {
    setEditingProject(null);
    setProjectForm({
      ...EMPTY_PROJECT_FORM,
      department_id: user?.department_id || '',
    });
    setShowProjectDialog(true);
  }

  function openEditProjectDialog(project) {
    setEditingProject(project);
    setProjectForm({
      name: project.name || '',
      description: project.description || '',
      client_id: project.client_id || '',
      department_id: project.department_id || '',
      color: project.color || '#6366f1',
      is_billable_default: Boolean(project.is_billable_default),
      is_active: Boolean(project.is_active),
    });
    setShowProjectDialog(true);
  }

  function closeProjectDialog() {
    setShowProjectDialog(false);
    setEditingProject(null);
    setProjectForm(EMPTY_PROJECT_FORM);
  }

  return (
    <PageShell>
      <PageHeader
        title="Project Management"
        description="Manage clients and projects that power the Clockify-style calendar."
      />

      <div className="space-y-6">
        <EntitySection
          title="Clients"
          description="Create and manage clients that group project work."
          icon={Building2}
          action={(
            <Button onClick={openCreateClientDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              New Client
            </Button>
          )}
        >
          {clientsLoading ? (
            <SectionLoader label="Loading clients..." className="py-6" />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <div key={client.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{client.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${client.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditClientDialog(client)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{client.description || 'No description added.'}</p>
                </div>
              ))}
              {clients.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No clients yet. Create one to start grouping projects.
                </div>
              ) : null}
            </div>
          )}
        </EntitySection>

        <EntitySection
          title="Projects"
          description="Projects can carry a client, color, department, and default billable setting. Approved timesheet hours are shown per project."
          icon={FolderKanban}
          action={(
            <Button onClick={openCreateProjectDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          )}
        >
          {projectsLoading ? (
            <SectionLoader label="Loading projects..." className="py-6" />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      />
                      <p className="font-medium text-foreground">{project.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${project.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {project.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditProjectDialog(project)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{project.description || 'No description added.'}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Client: {project.client_name || 'Unassigned'}</p>
                    <p>Department: {departments.find((department) => department.id === project.department_id)?.name || 'Shared'}</p>
                    <p>Billable default: {project.is_billable_default ? 'Yes' : 'No'}</p>
                  </div>
                  <ProjectApprovedHoursWidget
                    stats={approvedStatsByProject[project.id]}
                    loading={approvedHoursLoading}
                  />
                </div>
              ))}
              {projects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No projects yet. Create one so calendar entries can be linked to project work.
                </div>
              ) : null}
            </div>
          )}
        </EntitySection>
      </div>

      <Dialog open={showClientDialog} onOpenChange={(open) => (open ? setShowClientDialog(true) : closeClientDialog())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Create Client'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Client Name</label>
              <Input
                value={clientForm.name}
                onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Acme Holdings"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Textarea
                value={clientForm.description}
                onChange={(event) => setClientForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder="Optional context for this client"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Active client</p>
                <p className="text-xs text-muted-foreground">Inactive clients stay hidden from staff entry forms.</p>
              </div>
              <Switch
                checked={clientForm.is_active}
                onCheckedChange={(checked) => setClientForm((current) => ({ ...current, is_active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeClientDialog}>Cancel</Button>
            <Button
              onClick={handleCreateClient}
              disabled={createClient.isPending || updateClient.isPending || !clientForm.name.trim()}
            >
              {createClient.isPending || updateClient.isPending ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProjectDialog} onOpenChange={(open) => (open ? setShowProjectDialog(true) : closeProjectDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Project Name</label>
              <Input
                value={projectForm.name}
                onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Acme Rollout"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Textarea
                value={projectForm.description}
                onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder="Optional project notes"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Client</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={projectForm.client_id}
                onChange={(event) => setProjectForm((current) => ({ ...current, client_id: event.target.value }))}
              >
                <option value="">No client</option>
                {clients.filter((client) => client.is_active).map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Department</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={projectForm.department_id}
                onChange={(event) => setProjectForm((current) => ({ ...current, department_id: event.target.value }))}
              >
                <option value="">Shared / All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Color</label>
              <Input
                type="color"
                value={projectForm.color}
                onChange={(event) => setProjectForm((current) => ({ ...current, color: event.target.value }))}
                className="h-10"
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Billable by default</p>
                  <p className="text-xs text-muted-foreground">New entries inherit this unless changed.</p>
                </div>
                <Switch
                  checked={projectForm.is_billable_default}
                  onCheckedChange={(checked) => setProjectForm((current) => ({ ...current, is_billable_default: checked }))}
                />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Active project</p>
                  <p className="text-xs text-muted-foreground">Inactive projects are hidden from entry forms.</p>
                </div>
                <Switch
                  checked={projectForm.is_active}
                  onCheckedChange={(checked) => setProjectForm((current) => ({ ...current, is_active: checked }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeProjectDialog}>Cancel</Button>
            <Button
              onClick={handleCreateProject}
              disabled={createProject.isPending || updateProject.isPending || !projectForm.name.trim()}
            >
              {createProject.isPending || updateProject.isPending ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageShell>
  );
}
