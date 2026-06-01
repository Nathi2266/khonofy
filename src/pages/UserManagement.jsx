import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BadgeCheck, Users, Plus } from 'lucide-react';

const EMPTY_FORM = {
  email: '',
  fullName: '',
  password: '',
  role: 'staff',
};

export default function UserManagement() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.role === 'superuser',
  });

  const createUser = useMutation({
    mutationFn: async (payload) => {
      const created = await base44.entities.User.create(payload);
      return created;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      closeForm();
    },
  });

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''));
  }, [users]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = () => {
    if (!form.email.trim() || !form.password.trim()) return;
    createUser.mutate({
      email: form.email.trim(),
      fullName: form.fullName.trim(),
      password: form.password,
      role: form.role,
    });
  };

  if (currentUser?.role !== 'superuser') {
    return (
      <PageShell>
        <p className="text-center text-muted-foreground">Access restricted to super users.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="User Management"
        description="Create and review all admin and staff users in the system."
        icon={Users}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New User
          </Button>
        }
      />

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1.2fr_120px_140px] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Department / Designation</span>
        </div>

        {isLoading && <p className="text-center text-muted-foreground text-sm py-8">Loading users...</p>}

        <div className="divide-y divide-border">
          {sortedUsers.map((user) => (
            <div key={user.id} className="grid grid-cols-[1.2fr_1.2fr_120px_140px] gap-4 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
              <div>
                <p className="font-medium text-foreground">{user.full_name || 'Unnamed user'}</p>
                <p className="text-xs text-muted-foreground">{user.id}</p>
              </div>
              <span className="text-sm text-muted-foreground truncate">{user.email}</span>
              <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {user.role || 'staff'}
              </span>
              <div className="text-sm text-muted-foreground">
                <p className="truncate">{user.department_name || user.department_id || '—'}</p>
                <p className="truncate">{user.designation_name || user.designation_id || '—'}</p>
              </div>
            </div>
          ))}

          {sortedUsers.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <BadgeCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-foreground">No users found</p>
              <p className="text-muted-foreground text-sm">Create the first admin or staff user to get started.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Full Name</label>
              <Input
                placeholder="e.g. Jane Doe"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email *</label>
              <Input
                type="email"
                placeholder="e.g. jane@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Temporary Password *</label>
              <Input
                type="password"
                placeholder="Set a password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Role</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.email.trim() || !form.password.trim() || createUser.isPending}>
              {createUser.isPending ? 'Saving...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
