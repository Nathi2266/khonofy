import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';

export default function StatsCard({ label, value, icon: Icon, iconSrc, color = 'primary', sub }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className={`flex shrink-0 items-center justify-center rounded-xl ${iconSrc ? `${DASHBOARD_ICON_SIZES.kpi} bg-transparent` : `h-11 w-11 ${colorMap[color] || colorMap.primary}`}`}>
        {iconSrc ? (
          <DashboardIcon src={iconSrc} className={DASHBOARD_ICON_SIZES.kpi} />
        ) : Icon ? (
          <Icon className="w-5 h-5" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}