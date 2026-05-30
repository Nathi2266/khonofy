import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboard, ClipboardList, Clock, Users,
  CheckSquare, FileText, User, LogOut, Menu, ChevronRight,
  CalendarDays, BarChart3, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const STAFF_NAV = [
  { path: '/', label: 'My Dashboard', icon: LayoutDashboard },
  { path: '/daily-log', label: 'Daily Task Log', icon: ClipboardList },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/timesheets', label: 'My Timesheets', icon: Clock },
];

const ADMIN_NAV = [
  { path: '/', label: 'Team Dashboard', icon: LayoutDashboard },
  { path: '/team', label: 'Team Management', icon: Users },
  { path: '/tasks', label: 'Task Management', icon: CheckSquare },
  { path: '/timesheets/review', label: 'Timesheet Review', icon: Clock },
  { path: '/admin-reports', label: 'Reports', icon: BarChart3 },
  { path: '/tags', label: 'Tag Management', icon: Tag },
];

const SUPERUSER_NAV = [
  { path: '/', label: 'Global Dashboard', icon: LayoutDashboard },
  { path: '/audit-trail', label: 'Audit Trail', icon: FileText },
  { path: '/admin-reports', label: 'Reports', icon: BarChart3 },
  { path: '/tags', label: 'Tag Management', icon: Tag },
];

function getNavItems(role) {
  if (role === 'superuser') return SUPERUSER_NAV;
  if (role === 'admin') return ADMIN_NAV;
  return STAFF_NAV;
}

const ROLE_BADGE = {
  superuser: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  admin: 'bg-primary/20 text-blue-200 border-primary/30',
  staff: 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border',
};

const ROLE_LABEL = { superuser: 'Super User', admin: 'Admin', staff: 'Staff' };

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const role = user?.role || 'staff';
  const navItems = getNavItems(role);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 ease-in-out bg-sidebar flex flex-col flex-shrink-0 border-r border-sidebar-border`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">K</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <div>
                <p className="text-sidebar-foreground font-semibold text-base leading-tight">Khonofy</p>
                <p className="text-sidebar-foreground/50 text-xs">Time &amp; Task Tracking</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
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
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                {!collapsed && active && <ChevronRight className="w-4 h-4 ml-auto opacity-70" />}
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
            {!collapsed && <span className="text-sm font-medium">Profile</span>}
          </Link>
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-3 flex-shrink-0">
          {collapsed ? (
            <button
              onClick={() => base44.auth.logout()}
              className="w-full flex items-center justify-center p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">
                    {(user?.full_name || user?.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sidebar-foreground text-sm font-medium truncate leading-tight">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-sidebar-foreground/50 text-xs truncate">{user?.email || ''}</p>
                </div>
                <button
                  onClick={() => base44.auth.logout()}
                  className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1 rounded"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[role] || ROLE_BADGE.staff}`}>
                {ROLE_LABEL[role] || 'Staff'}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setCollapsed(!collapsed)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}