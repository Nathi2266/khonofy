import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import khonoImage from '@/assets/images/khono.png';
import calendarIcon from '@/assets/images/Calendar.png';
import sidebarIcon1 from '@/assets/images/side_bar/1.png';
import sidebarIcon2 from '@/assets/images/side_bar/2.png';
import sidebarIcon3 from '@/assets/images/side_bar/3.png';
import sidebarIcon4 from '@/assets/images/side_bar/4.png';
import sidebarIcon5 from '@/assets/images/side_bar/5.png';
import sidebarIcon6 from '@/assets/images/side_bar/6.png';
import sidebarIcon7 from '@/assets/images/side_bar/7.png';
import sidebarIcon8 from '@/assets/images/side_bar/8.png';
import sidebarIcon9 from '@/assets/images/side_bar/9.png';

const SIDEBAR_ICON_CLASS = 'w-10 h-10 flex-shrink-0 object-contain';

const STAFF_NAV = [
  { path: '/', label: 'Dashboard', iconSrc: sidebarIcon1 },
  { path: '/daily-log', label: 'Task Log', iconSrc: sidebarIcon4 },
  { path: '/calendar', label: 'Calendar', iconSrc: calendarIcon },
  { path: '/timesheets', label: 'Timesheets', iconSrc: sidebarIcon3 },
];

const ADMIN_NAV = [
  { path: '/', label: 'Dashboard', iconSrc: sidebarIcon1 },
  { path: '/team', label: 'Team Management', iconSrc: sidebarIcon2 },
  { path: '/tasks', label: 'Task Management', iconSrc: sidebarIcon4 },
  { path: '/timesheets/review', label: 'Timesheet Review', iconSrc: sidebarIcon3 },
  { path: '/admin-reports', label: 'Reports', iconSrc: sidebarIcon5 },
  { path: '/dept-summary', label: 'Estimates', iconSrc: calendarIcon },
  { path: '/projects', label: 'Projects', iconSrc: sidebarIcon6 },
  { path: '/tags', label: 'Tag Management', iconSrc: sidebarIcon7 },
];

const SUPERUSER_NAV = [
  { path: '/', label: 'Dashboard', iconSrc: sidebarIcon1 },
  { path: '/users', label: 'User Management', iconSrc: sidebarIcon2 },
  { path: '/timesheets/feedback', label: 'Timesheet Feedback', iconSrc: sidebarIcon3 },
  { path: '/audit-trail', label: 'Audit Trail', iconSrc: sidebarIcon4 },
  { path: '/admin-reports', label: 'Reports', iconSrc: sidebarIcon5 },
  { path: '/projects', label: 'Projects', iconSrc: sidebarIcon6 },
  { path: '/tags', label: 'Tag Management', iconSrc: sidebarIcon7 },
];

function getNavItems(role) {
  if (role === 'superuser') return SUPERUSER_NAV;
  if (role === 'admin') return ADMIN_NAV;
  return STAFF_NAV;
}

function SidebarNavIcon({ item, className = '' }) {
  return (
    <img
      src={item.iconSrc}
      alt=""
      aria-hidden="true"
      className={cn(SIDEBAR_ICON_CLASS, className)}
    />
  );
}

function navLinkClass(active) {
  return cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
    active
      ? 'bg-primary text-white shadow-sm'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
  );
}

export default function Layout() {
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const role = user?.role || 'staff';
  const navItems = getNavItems(role);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const isAdmin = role === 'admin';
  const onTimesheetReview = location.pathname === '/timesheets/review';

  const { data: timesheetReviewCount = 0 } = useQuery({
    queryKey: ['sidebarTimesheetReviewCount', user?.id],
    queryFn: async () => {
      const [pending, revokes] = await Promise.all([
        base44.entities.Timesheet.filter({ status: 'pending' }),
        base44.entities.Timesheet.filter({ status: 'revoke_pending' }),
      ]);
      return pending.length + revokes.length;
    },
    enabled: isAdmin && !!user?.id,
  });

  const showTimesheetReviewBadge = isAdmin && !onTimesheetReview && timesheetReviewCount > 0;

  return (
    <div className="flex h-app bg-background overflow-hidden">
      <aside className="w-64 flex flex-col flex-shrink-0 border-r border-sidebar-border bg-sidebar">
        <div className="flex flex-col items-center px-4 py-4 border-b border-sidebar-border flex-shrink-0">
          <img src={khonoImage} alt="KHONOFY" className="w-36 h-auto select-none pointer-events-none" />
          <p className="mt-1 text-sidebar-foreground font-semibold text-sm text-center leading-tight">
            Welcome to Khonofy
          </p>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={navLinkClass(active)}>
                <SidebarNavIcon item={item} />
                <span className="flex-1 text-sm font-bold">{item.label}</span>
                {item.path === '/timesheets/review' && showTimesheetReviewBadge ? (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {timesheetReviewCount}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="py-2"><div className="border-t border-sidebar-border" /></div>

          <Link
            to="/profile"
            className={navLinkClass(location.pathname === '/profile')}
          >
            <img
              src={sidebarIcon8}
              alt=""
              aria-hidden="true"
              className={SIDEBAR_ICON_CLASS}
            />
            <span className="text-sm font-bold">Profile</span>
          </Link>
        </nav>

        <div className="border-t border-sidebar-border p-3 flex-shrink-0">
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            aria-label="Log out"
          >
            <img
              src={sidebarIcon9}
              alt=""
              aria-hidden="true"
              className={SIDEBAR_ICON_CLASS}
            />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <Outlet />
      </main>

      {showLogoutDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border border-sidebar-border bg-sidebar p-4 text-sidebar-foreground shadow-xl">
            <h2 className="text-center text-lg font-semibold">Log out?</h2>
            <p className="mt-2 text-center text-sm text-sidebar-foreground/70">
              Are you sure you want to log out of Khonology - Khonofy?
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
