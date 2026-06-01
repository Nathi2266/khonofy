import { cn } from "@/lib/utils";

export default function PageHeader({ title, description, actions, className }) {
  const heading = (
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
