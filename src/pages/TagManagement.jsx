import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tag, Plus, Pencil, Trash2 } from 'lucide-react';

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];

const EMPTY_FORM = { name: '', color: '#6366f1', description: '' };

export default function TagManagement() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list(),
  });

  const createTag = useMutation({
    mutationFn: (data) => base44.entities.Tag.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); closeForm(); },
  });

  const updateTag = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tag.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); closeForm(); },
  });

  const deleteTag = useMutation({
    mutationFn: (id) => base44.entities.Tag.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tags'] }); setDeleting(null); },
  });

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); };
  const openEdit = (tag) => { setForm({ name: tag.name, color: tag.color || '#6366f1', description: tag.description || '' }); setEditing(tag); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editing) updateTag.mutate({ id: editing.id, data: form });
    else createTag.mutate(form);
  };

  if (user?.role !== 'superuser' && user?.role !== 'admin') {
    return <div className="p-6 text-center text-muted-foreground">Access restricted to admins and super users.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" /> Tag Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage tags that staff can use when logging time.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> New Tag</Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_80px] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Color</span><span>Name</span><span>Description</span><span className="text-right">Actions</span>
        </div>
        {isLoading && <p className="text-center text-muted-foreground text-sm py-8">Loading tags...</p>}
        <div className="divide-y divide-border">
          {tags.map(tag => (
            <div key={tag.id} className="grid grid-cols-[auto_1fr_1fr_80px] gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#6366f1' }} />
              <div>
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: tag.color || '#6366f1' }}
                >
                  {tag.name}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{tag.description || '—'}</span>
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
          {tags.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground">No tags yet</p>
              <p className="text-muted-foreground text-sm">Create tags so staff can categorize their time entries.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Edit Tag' : 'Create New Tag'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tag Name *</label>
              <Input placeholder="e.g. Bug Fix, Feature, Meeting" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
              {form.name && (
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: form.color }}>
                    {form.name}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Input placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete tag "{deleting?.name}"?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground px-6">Existing time entries using this tag will keep their tag name.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTag.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}