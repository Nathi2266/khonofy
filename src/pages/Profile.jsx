// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logActivity } from '@/utils/activityLogger';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Phone, Building2, Shield, Save, Check, BadgeCheck } from 'lucide-react';

const ROLE_LABELS = { superuser: 'Super User', admin: 'Admin', staff: 'Staff' };
const ROLE_COLORS = {
  superuser: 'bg-amber-100 text-amber-700 border-amber-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  staff: 'bg-slate-100 text-slate-600 border-slate-200',
};

function normalizeSouthAfricanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return `+27${digits}`;
}

function canEditPhone(role) {
  return ['admin', 'superuser', 'staff'].includes(role);
}

export default function Profile() {
  const { data: user, isLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: '', phone: '', departmentId: '', designationId: '' });
  const [saved, setSaved] = useState(false);
  const [phoneNotice, setPhoneNotice] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations'],
    queryFn: () => base44.entities.Designation.list(),
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        departmentId: user.department_id || '',
        designationId: user.designation_id || '',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: () => base44.auth.updateMe({
      phone: normalizeSouthAfricanPhone(form.phone),
      departmentId: form.departmentId || null,
      designationId: form.designationId || null,
    }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setPhoneNotice('Phone number auto-saved');
      setTimeout(() => setPhoneNotice(''), 2200);
      if (user) await logActivity(user, 'Updated profile', 'User', user.id);
    },
  });

  useEffect(() => {
    if (!user || !canEditPhone(user.role)) return;
    const normalized = normalizeSouthAfricanPhone(form.phone);
    const current = String(form.phone || '');
    if (!normalized || current === normalized || updateMutation.isPending) return;

    const timeoutId = setTimeout(() => {
      updateMutation.mutate();
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [form.phone, user, updateMutation.isPending]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full p-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <PageShell>
      <PageHeader
        title="My Profile"
        description="Manage your account information and preferences."
      />
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">
        <div className="space-y-6">
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

        {/* Editable fields */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h3 className="font-semibold text-foreground">Account Details</h3>
          <div className="space-y-5">
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
                placeholder="+27 81 471 9966"
                value={form.phone}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setForm({ ...form, phone: nextValue });
                }}
                onBlur={() => {
                  if (!user || !canEditPhone(user.role)) return;
                  const normalized = normalizeSouthAfricanPhone(form.phone);
                  if (normalized && normalized !== form.phone) {
                    setForm((current) => ({ ...current, phone: normalized }));
                    updateMutation.mutate();
                  }
                }}
                disabled={!canEditPhone(user?.role)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {canEditPhone(user?.role)
                  ? 'Numbers are saved automatically and formatted as +27...'
                  : 'Phone editing is not available for your role.'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-muted-foreground" /> Department
              </label>
              <Select
                value={form.departmentId || '__none__'}
                onValueChange={(value) => setForm({ ...form, departmentId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Choose from the departments created by your superuser.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <BadgeCheck className="w-4 h-4 text-muted-foreground" /> Designation
              </label>
              <Select
                value={form.designationId || '__none__'}
                onValueChange={(value) => setForm({ ...form, designationId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not assigned</SelectItem>
                  {designations.map((designation) => (
                    <SelectItem key={designation.id} value={designation.id}>
                      {designation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Choose from the designations created by your superuser.</p>
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
          </div>
          <div className="flex items-center justify-center gap-3">
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
            {phoneNotice ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                {phoneNotice}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}