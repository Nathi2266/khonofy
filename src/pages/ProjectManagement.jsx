import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import PageShell from '@/components/PageShell';
import PageHeader from '@/components/PageHeader';
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
import { Building2, FolderKanban, Plus } from 'lucide-react';

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
  const [showBulkClientDialog, setShowBulkClientDialog] = useState(false);
  const [showBulkProjectDialog, setShowBulkProjectDialog] = useState(false);
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
      if (user.role === 'superuser') return base44.entities.Project.list();
      if (user.department_id) return base44.entities.Project.filter({ department_id: user.department_id });
      return base44.entities.Project.list();
    },
    enabled: canManage,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: canManage,
  });

  const activeClientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients]
  );

  const createClient = useMutation({
    mutationFn: (payload) => base44.entities.Client.create(payload),
    onSuccess: async (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (user) await logActivity(user, 'Created client', 'Client', client.id, client.name);
      setShowClientDialog(false);
      setClientForm(EMPTY_CLIENT_FORM);
    },
  });

  const createProject = useMutation({
    mutationFn: (payload) => base44.entities.Project.create(payload),
    onSuccess: async (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (user) await logActivity(user, 'Created project', 'Project', project.id, project.name);
      setShowProjectDialog(false);
      setProjectForm(EMPTY_PROJECT_FORM);
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
    createClient.mutate(clientForm);
  };

  const handleCreateProject = () => {
    if (!projectForm.name.trim()) return;
    const selectedClient = clients.find((client) => client.id === projectForm.client_id);
    createProject.mutate({
      ...projectForm,
      client_name: selectedClient?.name || '',
      department_id: projectForm.department_id || user?.department_id || '',
    });
  };

  const bulkClientNames = parseBulkNames(bulkClientText);
  const bulkProjectNames = parseBulkNames(bulkProjectText);

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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkClientDialog(true)}>Bulk Add</Button>
              <Button onClick={() => setShowClientDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Client
              </Button>
            </div>
          )}
        >
          {clientsLoading ? (
            <p className="text-sm text-muted-foreground">Loading clients...</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <div key={client.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{client.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${client.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
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
          description="Projects can carry a client, color, department, and default billable setting."
          icon={FolderKanban}
          action={(
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkProjectDialog(true)}>Bulk Add</Button>
              <Button onClick={() => setShowProjectDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </div>
          )}
        >
          {projectsLoading ? (
            <p className="text-sm text-muted-foreground">Loading projects...</p>
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
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${project.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {project.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{project.description || 'No description added.'}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Client: {project.client_name || 'Unassigned'}</p>
                    <p>Department: {departments.find((department) => department.id === project.department_id)?.name || 'Shared'}</p>
                    <p>Billable default: {project.is_billable_default ? 'Yes' : 'No'}</p>
                  </div>
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

      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Client</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowClientDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateClient} disabled={createClient.isPending || !clientForm.name.trim()}>
              {createClient.isPending ? 'Saving...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
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
            <Button variant="outline" onClick={() => setShowProjectDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={createProject.isPending || !projectForm.name.trim()}>
              {createProject.isPending ? 'Saving...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkClientDialog} onOpenChange={setShowBulkClientDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Add Clients</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Paste one client name per line. Duplicate names in the paste are ignored.</p>
            <Textarea
              rows={10}
              value={bulkClientText}
              onChange={(event) => setBulkClientText(event.target.value)}
              placeholder="Acme Holdings&#10;Khonofy Internal&#10;Northwind Labs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkClientDialog(false)}>Cancel</Button>
            <Button onClick={() => bulkCreateClients.mutate(bulkClientNames)} disabled={!bulkClientNames.length || bulkCreateClients.isPending}>
              {bulkCreateClients.isPending ? 'Saving...' : 'Create Clients'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkProjectDialog} onOpenChange={setShowBulkProjectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Add Projects</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Attach to client</label>
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
            <p className="text-sm text-muted-foreground">Paste one project name per line. Each project uses the selected client and your department by default.</p>
            <Textarea
              rows={10}
              value={bulkProjectText}
              onChange={(event) => setBulkProjectText(event.target.value)}
              placeholder="Website Refresh&#10;Customer Onboarding&#10;Internal Training"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkProjectDialog(false)}>Cancel</Button>
            <Button
              onClick={() => bulkCreateProjects.mutate({ names: bulkProjectNames, clientId: projectForm.client_id })}
              disabled={!bulkProjectNames.length || bulkCreateProjects.isPending}
            >
              {bulkCreateProjects.isPending ? 'Saving...' : 'Create Projects'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
