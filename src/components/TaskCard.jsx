import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User } from 'lucide-react';

const PRIORITY_STYLES = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_STYLES = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-600',
};

export default function TaskCard({ task, onClick, actions }) {
  return (
    <div
      className={`bg-card rounded-xl border border-border p-4 hover:shadow-sm transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-primary/30' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight">{task.title}</p>
          {task.description && (
            <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
          {task.priority}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[task.status] || STATUS_STYLES.todo}`}>
          {task.status?.replace('_', ' ')}
        </span>
        {task.due_date && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
        {task.assigned_to_name && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3" />
            {task.assigned_to_name}
          </span>
        )}
        {task.estimated_hours && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {task.estimated_hours}h est.
          </span>
        )}
      </div>
    </div>
  );
}