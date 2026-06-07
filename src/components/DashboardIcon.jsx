/** Shared dashboard PNG icon sizes (matches SuperuserDashboard). */
export const DASHBOARD_ICON_SIZES = {
  hero: 'h-[3.6rem] w-[3.6rem]',
  kpi: 'h-[3.3rem] w-[3.3rem]',
  section: 'h-9 w-9',
  inline: 'h-[2.7rem] w-[2.7rem]',
  alert: 'h-[3rem] w-[3rem]',
};

export default function DashboardIcon({
  src,
  className = DASHBOARD_ICON_SIZES.kpi,
  alt = '',
}) {
  return <img src={src} alt={alt} className={`object-contain shrink-0 ${className}`} />;
}
