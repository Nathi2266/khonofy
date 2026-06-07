import { cn } from "@/lib/utils";
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';

export default function PageHeader({ title, description, actions, icon: Icon, iconSrc, iconClassName = DASHBOARD_ICON_SIZES.section, className = undefined }) {
  const heading = (Icon || iconSrc) ? (
    <div className="flex items-center gap-2">
      {iconSrc ? (
        <DashboardIcon src={iconSrc} className={iconClassName} />
      ) : (
        <Icon className="w-6 h-6 text-primary" />
      )}
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
    </div>
  ) : (
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
  );

  const subtitle = description ? (
    <p className="text-muted-foreground mt-1 text-sm">{description}</p>
  ) : null;

  if (actions) {
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <div>
          {heading}
          {subtitle}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className={className}>
      {heading}
      {subtitle}
    </div>
  );
}
