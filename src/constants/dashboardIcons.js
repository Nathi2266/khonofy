import dashboardIcon10 from '@/assets/images/dashboard/10.png';
import dashboardIcon13 from '@/assets/images/dashboard/13.png';
import dashboardIcon18 from '@/assets/images/dashboard/18.png';
import dashboardIcon20 from '@/assets/images/dashboard/20.png';

export const TIMESHEET_STATUS_ICONS = {
  draft: dashboardIcon10,
  pending: dashboardIcon18,
  approved: dashboardIcon20,
  rejected: dashboardIcon13,
  revoke_pending: dashboardIcon18,
};

export const TIMESHEET_STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  revoke_pending: 'bg-purple-100 text-purple-700',
};
