import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import StaffDashboard from '@/components/dashboard/StaffDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import SuperuserDashboard from '@/components/dashboard/SuperuserDashboard';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <p className="text-muted-foreground text-sm">Please log in to view your dashboard.</p>
        <button
          onClick={() => base44.auth.redirectToLogin()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (user.role === 'superuser') return <SuperuserDashboard user={user} />;
  if (user.role === 'admin') return <AdminDashboard user={user} />;
  return <StaffDashboard user={user} />;
}