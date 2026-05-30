import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Phone, Building2, Shield, Save, Check } from 'lucide-react';

const ROLE_LABELS = { superuser: 'Super User', admin: 'Admin', staff: 'Staff' };
const ROLE_COLORS = {
  superuser: 'bg-amber-100 text-amber-700 border-amber-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  staff: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function Profile() {
  const { data: user, isLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [saved, setSaved] = useState(false);

  const { data: department } = useQuery({
    queryKey: ['dept', user?.department_id],
    queryFn: () => base44.entities.Department.filter({ id: user.department_id }),
    enabled: !!user?.department_id,
    select: (depts) => depts[0],
  });

  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name || '', phone: user.phone || '' });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: () => base44.auth.updateMe({ phone: form.phone }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (user) await logActivity(user, 'Updated profile', 'User', user.id);
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-full p-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account information and preferences.</p>
      </div>

      {/* Avatar + role */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold text-3xl">
              {(user?.full_name || user?.email || '?')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{user?.full_name || 'User'}</h2>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
            <span className={`inline-flex mt-2 items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${ROLE_COLORS[user?.role] || ROLE_COLORS.staff}`}>
              <Shield className="w-3 h-3" />
              {ROLE_LABELS[user?.role] || 'Staff'}
            </span>
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h3 className="font-semibold text-foreground">Account Details</h3>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <User className="w-4 h-4 text-muted-foreground" /> Full Name
          </label>
          <Input
            value={form.full_name}
            disabled
            className="bg-muted/40"
          />
          <p className="text-xs text-muted-foreground mt-1">Name is managed by your account settings.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-muted-foreground" /> Email Address
          </label>
          <Input value={user?.email || ''} disabled className="bg-muted/40" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-muted-foreground" /> Phone Number
          </label>
          <Input
            placeholder="+1 (555) 000-0000"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-muted-foreground" /> Department
          </label>
          <Input
            value={department?.name || (user?.department_id ? 'Loading...' : 'Not assigned')}
            disabled
            className="bg-muted/40"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-muted-foreground" /> Role
          </label>
          <Input
            value={ROLE_LABELS[user?.role] || 'Staff'}
            disabled
            className="bg-muted/40"
          />
          <p className="text-xs text-muted-foreground mt-1">Roles are assigned by your system administrator.</p>
        </div>

        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || saved}
          className="gap-2"
        >
          {saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : updateMutation.isPending ? (
            'Saving...'
          ) : (
            <><Save className="w-4 h-4" /> Save Changes</>
          )}
        </Button>
      </div>

      {/* Account stats */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4">Account Info</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Member since</p>
            <p className="font-medium text-foreground mt-0.5">
              {user?.created_date ? new Date(user.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">User ID</p>
            <p className="font-medium text-foreground font-mono text-xs mt-0.5">{user?.id?.slice(0, 12)}...</p>
          </div>
        </div>
      </div>
    </div>
  );
}