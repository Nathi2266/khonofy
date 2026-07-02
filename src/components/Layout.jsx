import { Link, useLocation, Outlet } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuth } from '@/lib/AuthContext';
import { GLOBAL_LOADING_MIN_MS, useGlobalLoadingVisible } from '@/hooks/useGlobalLoading';
import { useLoading } from '@/lib/LoadingContext';
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
import sidebarIcon9 from '@/assets/images/side_bar/9.png';
import profileIcon from '@/assets/images/side_bar/8.png';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SIDEBAR_ICON_CLASS = 'w-10 h-10 flex-shrink-0 object-contain';
const REVOKE_WINDOW_MS = 24 * 60 * 60 * 1000;
const SIDEBAR_COLLAPSE_STORAGE_KEY = 'khonofy.sidebarCollapsed';
const STAFF_NAV = [
  { path: '/', label: 'Dashboard', iconSrc: sidebarIcon1 },
  { path: '/daily-log', label: 'Task Log', iconSrc: sidebarIcon4 },
  { path: '/tasks', label: 'Task Management', iconSrc: sidebarIcon4 },
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

function SidebarNavIcon({ iconSrc, shouldPulse = false, className = '' }) {
  return (
    <img
      src={iconSrc}
      alt=""
      aria-hidden="true"
      className={cn(
        SIDEBAR_ICON_CLASS,
        'transition-transform duration-200 ease-out',
        shouldPulse
          ? 'animate-sidebar-icon-heartbeat'
          : 'group-hover:scale-110 group-hover:-rotate-3',
        className,
      )}
    />
  );
}

function getUserAvatarSrc(user) {
  return user?.profile_image_url || '';
}

function navLinkClass(active, collapsed = false) {
  return cn(
    'group flex items-center rounded-lg transition-all duration-200 ease-out',
    collapsed ? 'justify-center gap-0 px-2 py-2.5' : 'gap-3 px-3 py-2.5',
    active
      ? 'bg-primary text-white shadow-sm hover:shadow-md hover:brightness-105'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    collapsed ? 'hover:translate-x-0' : 'hover:translate-x-1 hover:shadow-md',
  );
}

export default function Layout() {
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const { logout } = useAuth();
  const role = user?.role || 'staff';
  const navItems = getNavItems(role);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [spinningPath, setSpinningPath] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const globalLoadingVisible = useGlobalLoadingVisible();
  const { showLoading, hideLoading } = useLoading();
  const navLoadTimerRef = useRef(null);
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
  const userAvatarSrc = getUserAvatarSrc(user);

  const triggerNavLoad = (path) => {
    setSpinningPath(path);
    showLoading();
    if (navLoadTimerRef.current) {
      clearTimeout(navLoadTimerRef.current);
    }
    navLoadTimerRef.current = window.setTimeout(() => {
      hideLoading();
      navLoadTimerRef.current = null;
    }, GLOBAL_LOADING_MIN_MS);
  };

  useEffect(() => {
    if (!globalLoadingVisible) {
      setSpinningPath('');
    }
  }, [globalLoadingVisible]);

  useEffect(() => () => {
    if (navLoadTimerRef.current) {
      clearTimeout(navLoadTimerRef.current);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(isSidebarCollapsed));
    } catch {
      // Ignore storage issues and keep the current UI state in memory.
    }
  }, [isSidebarCollapsed]);

  const isIconPulsing = (path) => globalLoadingVisible && spinningPath === path;
  const sidebarItemLabelClass = isSidebarCollapsed ? 'sr-only' : 'flex-1 text-sm font-bold';
  const sidebarRootClass = cn(
    'flex h-app flex-col flex-shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out',
    isSidebarCollapsed ? 'w-20' : 'w-64',
  );
  const sidebarHeaderClass = cn(
    'flex flex-shrink-0 items-center justify-center border-b border-sidebar-border',
    isSidebarCollapsed ? 'px-2 py-3' : 'px-4 py-4',
  );
  const sidebarNavClass = cn(
    'flex-1 overflow-y-auto space-y-0.5 py-3',
    isSidebarCollapsed ? 'px-1' : 'px-2',
  );
  const sidebarToggleButtonClass = cn(
    'group flex w-full items-center justify-center rounded-lg border border-sidebar-border bg-sidebar px-3 py-2.5 text-sm font-bold text-sidebar-foreground transition-all duration-200 ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-md',
    isSidebarCollapsed ? 'gap-0 px-2 hover:translate-x-0' : 'gap-2 hover:translate-x-1',
  );
  const sidebarLogoutButtonClass = cn(
    'group flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-bold text-sidebar-foreground transition-all duration-200 ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-md',
    isSidebarCollapsed ? 'gap-0 px-2 hover:translate-x-0' : 'gap-2 hover:translate-x-1',
  );

  return (
    <div className="flex h-app bg-background overflow-hidden">
      <aside
        id="app-sidebar"
        aria-label="Primary navigation"
        className={sidebarRootClass}
      >
        <div className={sidebarHeaderClass}>
          {!isSidebarCollapsed ? (
            <img
              src={khonoImage}
              alt="KHONOFY"
              className="w-36 h-auto select-none pointer-events-none"
            />
          ) : null}
        </div>

        {!isSidebarCollapsed ? (
          <p className="px-4 pb-3 text-center text-sm font-semibold leading-tight text-sidebar-foreground">
            Welcome to Khonofy
          </p>
        ) : null}

        <nav className={sidebarNavClass}>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={navLinkClass(active, isSidebarCollapsed)}
                onClick={() => triggerNavLoad(item.path)}
                aria-label={item.label}
                title={item.label}
              >
                <SidebarNavIcon
                  iconSrc={item.iconSrc}
                  shouldPulse={isIconPulsing(item.path)}
                />
                <span className={sidebarItemLabelClass}>{item.label}</span>
                {item.path === '/timesheets/review' && showTimesheetReviewBadge && !isSidebarCollapsed ? (
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
            className={cn(navLinkClass(location.pathname === '/profile', isSidebarCollapsed), 'focus:outline-none focus-visible:outline-none')}
            onClick={() => triggerNavLoad('/profile')}
            aria-label="Profile"
            title="Profile"
          >
            {userAvatarSrc ? (
              <img
                src={userAvatarSrc}
                alt={user?.full_name || 'Profile photo'}
                className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <img
                src={profileIcon}
                alt=""
                aria-hidden="true"
                className="h-10 w-10 flex-shrink-0 object-contain"
              />
            )}
            <span className={sidebarItemLabelClass}>Profile</span>
          </Link>
        </nav>

        <div className={cn('border-t border-sidebar-border flex-shrink-0', isSidebarCollapsed ? 'p-2' : 'p-3')}>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-controls="app-sidebar"
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={sidebarToggleButtonClass}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            <span className={sidebarItemLabelClass}>
              {isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogoutDialog(true)}
            className={cn(sidebarLogoutButtonClass, 'mt-2')}
            aria-label="Log out"
            title="Log out"
          >
            <img
              src={sidebarIcon9}
              alt=""
              aria-hidden="true"
              className={cn(
                SIDEBAR_ICON_CLASS,
                'transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-rotate-3',
              )}
            />
            <span className={sidebarItemLabelClass}>Logout</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
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
                onClick={() => {
                  setShowLogoutDialog(false);
                  logout();
                }}
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
