import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import SectionLoader from '@/components/SectionLoader';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import dashboardIcon1 from '@/assets/images/dashboard/1.png';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon19 from '@/assets/images/dashboard/19.png';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];
const EMPTY_FORM = { name: '', color: '#6366f1', description: '' };
const PAGE_SIZE = 20;
const TAG_PAGE_SIZE = 7;

function uniqueLines(value) {
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

function uniqueNormalizedLines(value) {
  return uniqueLines(value).filter((line, index, arr) => {
    const normalized = line.toLowerCase();
    return arr.findIndex((candidate) => candidate.toLowerCase() === normalized) === index;
  });
}

function PaginatedTable({
  title,
  description,
  iconSrc,
  items,
  isLoading,
  emptyTitle,
  emptyDescription,
  search,
  renderRow,
  columns = 3,
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visibleItems = items.slice(start, start + PAGE_SIZE);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-border bg-muted/30">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <DashboardIcon src={iconSrc} className={DASHBOARD_ICON_SIZES.section} />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {search ? <div className="w-full sm:w-auto">{search}</div> : null}
          {items.length > PAGE_SIZE ? (
            <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
            >
              Prev
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </Button>
            </div>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <SectionLoader label={`Loading ${title.toLowerCase()}...`} />
      ) : (
        <>
          <div className={`grid gap-px bg-border ${columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
            {visibleItems.map((item, index) => renderRow(item, start + index, columns))}
          </div>
          {items.length === 0 ? (
            <div className="text-center py-12">
              <DashboardIcon src={iconSrc} className={`mx-auto mb-3 opacity-40 ${DASHBOARD_ICON_SIZES.hero}`} />
              <p className="font-medium text-foreground">{emptyTitle}</p>
              <p className="text-muted-foreground text-sm">{emptyDescription}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function TagManagement() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isSuperuser = user?.role === 'superuser';
  const isAdmin = user?.role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bulkDialog, setBulkDialog] = useState(null);
  const [bulkText, setBulkText] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [designationSearch, setDesignationSearch] = useState('');
  const [detailView, setDetailView] = useState(null);

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list(),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['tagUsageTimeEntries'],
    queryFn: () => base44.entities.TimeEntry.list(),
  });

  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: isSuperuser,
  });

  const { data: designations = [], isLoading: designationsLoading } = useQuery({
    queryKey: ['designations'],
    queryFn: () => base44.entities.Designation.list(),
    enabled: isSuperuser,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['tagUsageUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isSuperuser,
  });

  const existingDepartmentNames = new Set(departments.map((item) => item.name.trim().toLowerCase()));
  const existingDesignationNames = new Set(designations.map((item) => item.name.trim().toLowerCase()));
  const [tagPage, setTagPage] = useState(1);

  const tagUsageById = timeEntries.reduce((acc, entry) => {
    if (!entry.tag_id) return acc;
    acc[entry.tag_id] = (acc[entry.tag_id] || 0) + 1;
    return acc;
  }, {});

  const departmentUsageById = users.reduce((acc, userRecord) => {
    if (!userRecord.department_id) return acc;
    acc[userRecord.department_id] = (acc[userRecord.department_id] || 0) + 1;
    return acc;
  }, {});

  const designationUsageById = users.reduce((acc, userRecord) => {
    if (!userRecord.designation_id) return acc;
    acc[userRecord.designation_id] = (acc[userRecord.designation_id] || 0) + 1;
    return acc;
  }, {});

  const filteredDepartments = departments.filter((department) =>
    department.name.toLowerCase().includes(departmentSearch.trim().toLowerCase())
  );
  const filteredDesignations = designations.filter((designation) =>
    designation.name.toLowerCase().includes(designationSearch.trim().toLowerCase())
  );
  const detailUsers = detailView?.type === 'department'
    ? users.filter((item) => item.department_id === detailView.id)
    : detailView?.type === 'designation'
      ? users.filter((item) => item.designation_id === detailView.id)
      : [];

  const createTag = useMutation({
    mutationFn: (data) => base44.entities.Tag.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeForm();
    },
  });

  const updateTag = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tag.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeForm();
    },
  });

  const deleteTag = useMutation({
    mutationFn: (id) => base44.entities.Tag.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setDeleting(null);
    },
  });

  const bulkCreate = useMutation({
    mutationFn: async ({ type, names }) => {
      const creator =
        type === 'department'
          ? (name) => base44.entities.Department.create({ name })
          : (name) => base44.entities.Designation.create({ name });

      for (const name of names) {
        try {
          await creator(name);
        } catch (error) {
          const status = error?.status ?? error?.response?.status;
          const message = String(error?.message || '');
          if (status === 409 || /unique|duplicate/i.test(message)) {
            continue;
          }
          throw error;
        }
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: variables.type === 'department' ? ['departments'] : ['designations'],
      });
      closeBulkDialog();
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (tag) => {
    setForm({ name: tag.name, color: tag.color || '#6366f1', description: tag.description || '' });
    setEditing(tag);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openBulkDialog = (type) => {
    setBulkDialog(type);
    setBulkText('');
  };

  const closeBulkDialog = () => {
    setBulkDialog(null);
    setBulkText('');
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editing) updateTag.mutate({ id: editing.id, data: form });
    else createTag.mutate(form);
  };

  const handleBulkSubmit = () => {
    if (!bulkDialog) return;
    const names = uniqueNormalizedLines(bulkText);
    if (!names.length) return;

    const existingNames = bulkDialog === 'department' ? existingDepartmentNames : existingDesignationNames;
    const duplicates = names.filter((name) => existingNames.has(name.trim().toLowerCase()));
    if (duplicates.length) {
      window.alert(`These ${bulkDialog}s already exist: ${duplicates.join(', ')}`);
      return;
    }

    bulkCreate.mutate({ type: bulkDialog, names });
  };

  const tagTotalPages = Math.max(1, Math.ceil(tags.length / TAG_PAGE_SIZE));
  const safeTagPage = Math.min(tagPage, tagTotalPages);
  const tagStart = (safeTagPage - 1) * TAG_PAGE_SIZE;
  const visibleTags = tags.slice(tagStart, tagStart + TAG_PAGE_SIZE);

  if (!isSuperuser && !isAdmin) {
    return (
      <PageShell>
        <p className="text-center text-muted-foreground">Access restricted to admins and super users.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Tag Management"
        description="Create tags, departments, and designations used across the app."
        iconSrc={dashboardIcon4}
      />

      <div className="w-full space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Tag
          </Button>
          {isSuperuser ? (
            <>
              <Button variant="outline" onClick={() => openBulkDialog('department')} className="gap-2">
                <DashboardIcon src={dashboardIcon19} className={DASHBOARD_ICON_SIZES.section} />
                + Department
              </Button>
              <Button variant="outline" onClick={() => openBulkDialog('designation')} className="gap-2">
                <DashboardIcon src={dashboardIcon1} className={DASHBOARD_ICON_SIZES.section} />
                + Designation
              </Button>
            </>
          ) : null}
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_1fr_120px_80px] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Color</span>
            <span>Name</span>
            <span>Usage Summary</span>
          <span>Usage</span>
            <span className="text-right flex items-center justify-end gap-2">
              <span>Actions</span>
              {tags.length > TAG_PAGE_SIZE ? (
                <span className="inline-flex items-center gap-1 text-[11px] normal-case font-medium text-muted-foreground">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setTagPage((current) => Math.max(1, current - 1))}
                    disabled={safeTagPage === 1}
                  >
                    Prev
                  </Button>
                  <span>{safeTagPage} / {tagTotalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setTagPage((current) => Math.min(tagTotalPages, current + 1))}
                    disabled={safeTagPage === tagTotalPages}
                  >
                    Next
                  </Button>
                </span>
              ) : null}
            </span>
          </div>
          {tagsLoading ? <SectionLoader label="Loading tags..." /> : null}
          <div className="divide-y divide-border">
            {visibleTags.map((tag) => (
              <div key={tag.id} className="grid grid-cols-[auto_1fr_1fr_120px_80px] gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#6366f1' }} />
                <div>
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: tag.color || '#6366f1' }}
                  >
                    {tag.name}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {tag.description || 'Used for organizing and filtering time entries.'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {tagUsageById[tag.id] || 0} time entr{(tagUsageById[tag.id] || 0) === 1 ? 'y' : 'ies'}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(tag)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(tag)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {tags.length === 0 && !tagsLoading && (
              <div className="text-center py-12">
                <DashboardIcon src={dashboardIcon4} className={`mx-auto mb-3 opacity-40 ${DASHBOARD_ICON_SIZES.hero}`} />
                <p className="font-medium text-foreground">No tags yet</p>
                <p className="text-muted-foreground text-sm">Create tags so staff can categorize their time entries.</p>
              </div>
            )}
          </div>
        </div>

        {isSuperuser ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PaginatedTable
              title="Departments"
              description="Browse departments in pages of twenty."
              iconSrc={dashboardIcon19}
              items={filteredDepartments}
              isLoading={departmentsLoading}
              emptyTitle={departmentSearch.trim() ? 'No departments match your search' : 'No departments yet'}
              emptyDescription={
                departmentSearch.trim()
                  ? 'Try a different department name.'
                  : 'Add departments here so users can choose them in their profile.'
              }
              columns={1}
              search={
                <Input
                  type="search"
                  placeholder="Search departments..."
                  value={departmentSearch}
                  onChange={(e) => {
                    setDepartmentSearch(e.target.value);
                  }}
                  className="w-full sm:w-72 bg-background border-border"
                />
              }
              renderRow={(department) => (
                <>
                  <div key={department.id} className="bg-card px-4 py-3 min-h-[56px] flex items-center transition-all duration-200 ease-out hover:bg-muted/30 hover:shadow-sm hover:-translate-y-0.5 hover:border-primary/20">
                    <div className="flex w-full items-center justify-between gap-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                      <p className="font-medium text-foreground whitespace-normal break-words">{department.name}</p>
                      <button
                        type="button"
                        onClick={() => setDetailView((current) => (
                          current?.type === 'department' && current?.id === department.id
                            ? null
                            : { type: 'department', id: department.id, name: department.name }
                        ))}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                          detailView?.type === 'department' && detailView?.id === department.id
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm'
                        }`}
                        aria-expanded={detailView?.type === 'department' && detailView?.id === department.id}
                      >
                        {departmentUsageById[department.id] || 0} user{(departmentUsageById[department.id] || 0) === 1 ? '' : 's'}
                      </button>
                    </div>
                  </div>
                  {detailView?.type === 'department' && detailView?.id === department.id ? (
                    <div className="border-t border-border bg-muted/20 px-4 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Users</p>
                      <div className="flex flex-wrap gap-2">
                        {detailUsers.map((item) => (
                          <Badge key={item.id} variant="outline" className="rounded-full bg-background px-3 py-1">
                            {item.full_name || item.email}
                          </Badge>
                        ))}
                        {detailUsers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No users linked to this department.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            />

            <PaginatedTable
              title="Designations"
              description="Browse designations in pages of twenty."
              iconSrc={dashboardIcon1}
              items={filteredDesignations}
              isLoading={designationsLoading}
              emptyTitle={designationSearch.trim() ? 'No designations match your search' : 'No designations yet'}
              emptyDescription={
                designationSearch.trim()
                  ? 'Try a different designation name.'
                  : 'Add designations here so users can choose them in their profile.'
              }
              columns={1}
              search={
                <Input
                  type="search"
                  placeholder="Search designations..."
                  value={designationSearch}
                  onChange={(e) => {
                    setDesignationSearch(e.target.value);
                  }}
                  className="w-full sm:w-72 bg-background border-border"
                />
              }
              renderRow={(designation) => (
                <>
                  <div key={designation.id} className="bg-card px-4 py-3 min-h-[56px] flex items-center transition-all duration-200 ease-out hover:bg-muted/30 hover:shadow-sm hover:-translate-y-0.5 hover:border-primary/20">
                    <div className="flex w-full items-center justify-between gap-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                      <p className="font-medium text-foreground whitespace-normal break-words">{designation.name}</p>
                      <button
                        type="button"
                        onClick={() => setDetailView((current) => (
                          current?.type === 'designation' && current?.id === designation.id
                            ? null
                            : { type: 'designation', id: designation.id, name: designation.name }
                        ))}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                          detailView?.type === 'designation' && detailView?.id === designation.id
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm'
                        }`}
                        aria-expanded={detailView?.type === 'designation' && detailView?.id === designation.id}
                      >
                        {designationUsageById[designation.id] || 0} user{(designationUsageById[designation.id] || 0) === 1 ? '' : 's'}
                      </button>
                    </div>
                  </div>
                  {detailView?.type === 'designation' && detailView?.id === designation.id ? (
                    <div className="border-t border-border bg-muted/20 px-4 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Users</p>
                      <div className="flex flex-wrap gap-2">
                        {detailUsers.map((item) => (
                          <Badge key={item.id} variant="outline" className="rounded-full bg-background px-3 py-1">
                            {item.full_name || item.email}
                          </Badge>
                        ))}
                        {detailUsers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No users linked to this designation.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            />
          </div>
        ) : null}
      </div>

      <Dialog open={showForm} onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tag Name *</label>
              <Input
                placeholder="e.g. Bug Fix, Feature, Meeting"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
              </div>
              {form.name && (
                <div className="mt-3">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: form.color }}
                  >
                    {form.name}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || createTag.isPending || updateTag.isPending}>
              {createTag.isPending || updateTag.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bulkDialog} onOpenChange={(open) => (open ? null : closeBulkDialog())}>
        <DialogContent className="w-full max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkDialog === 'department' ? 'Add Departments' : 'Add Designations'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Paste one {bulkDialog === 'department' ? 'department' : 'designation'} per line.
              Each line will be created as its own record.
            </p>
            <Textarea
              rows={10}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={
                bulkDialog === 'department'
                  ? 'Developer\nUI/UX\nQA'
                  : 'Junior Designer\nSenior Designer\nProduct Designer'
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeBulkDialog}>Cancel</Button>
            <Button onClick={handleBulkSubmit} disabled={!uniqueLines(bulkText).length || bulkCreate.isPending}>
              {bulkCreate.isPending ? 'Saving...' : 'Create All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag "{deleting?.name}"?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">Existing time entries using this tag will keep their tag name.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTag.mutate(deleting.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}