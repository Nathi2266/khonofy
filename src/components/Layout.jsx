import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboard, ClipboardList, Clock, Users,
  CheckSquare, FileText, User, LogOut, UserRoundPlus,
  CalendarDays, BarChart3, Tag, Target, FolderKanban
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import khonoImage from '@/assets/images/khono.png';

const STAFF_NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/daily-log', label: 'Task Log', icon: ClipboardList },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/timesheets', label: 'Timesheets', icon: Clock },
];

const ADMIN_NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/team', label: 'Team Management', icon: Users },
  { path: '/tasks', label: 'Task Management', icon: CheckSquare },
  { path: '/timesheets/review', label: 'Timesheet Review', icon: Clock },
  { path: '/admin-reports', label: 'Reports', icon: BarChart3 },
  { path: '/dept-summary', label: 'Hours vs Estimates', icon: Target },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/tags', label: 'Tag Management', icon: Tag },
];

const SUPERUSER_NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: 'User Management', icon: UserRoundPlus },
  { path: '/audit-trail', label: 'Audit Trail', icon: FileText },
  { path: '/admin-reports', label: 'Reports', icon: BarChart3 },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/tags', label: 'Tag Management', icon: Tag },
];

function getNavItems(role) {
  if (role === 'superuser') return SUPERUSER_NAV;
  if (role === 'admin') return ADMIN_NAV;
  return STAFF_NAV;
}

export default function Layout() {
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const navItems = getNavItems(user?.role || 'staff');
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 flex flex-col flex-shrink-0 border-r border-sidebar-border bg-sidebar">
        <div className="flex flex-col items-center px-4 py-4 border-b border-sidebar-border flex-shrink-0">
          <img src={khonoImage} alt="KHONOFY" className="w-36 h-auto select-none pointer-events-none" />
          <p className="mt-1 text-sidebar-foreground font-semibold text-sm text-center leading-tight">
            Welcome to Khonofy
          </p>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}

          <div className="py-2"><div className="border-t border-sidebar-border" /></div>

          <Link
            to="/profile"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
              location.pathname === '/profile'
                ? 'bg-primary text-white'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Profile</span>
          </Link>
        </nav>

        <div className="border-t border-sidebar-border p-3 flex-shrink-0">
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <Outlet />
      </main>

      {showLogoutDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-xl border border-sidebar-border bg-sidebar p-6 text-sidebar-foreground shadow-xl">
            <h2 className="text-center text-lg font-semibold">Log out?</h2>
            <p className="mt-2 text-center text-sm text-sidebar-foreground/70">
              Are you sure you want to log out of Khonofy?
            </p>
            <div className="mt-6 flex items-center justify-between gap-1.5">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-sidebar-border bg-sidebar px-3.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setShowLogoutDialog(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md bg-destructive px-3.5 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                onClick={() => base44.auth.logout()}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
