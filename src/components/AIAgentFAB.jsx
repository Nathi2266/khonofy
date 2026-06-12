import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import aiAvatar from '@/assets/images/Ai_Avatar.gif';

export default function AIAgentFAB({ className = undefined }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === '/ai-assistant';

  return (
    <button
      type="button"
      onClick={() => navigate('/ai-assistant')}
      title="Open AI Assistant"
      className={cn(
        'relative h-12 w-12 overflow-hidden rounded-full shadow-xl transition-all duration-300 hover:scale-110 active:scale-95',
        isActive
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          : 'ring-1 ring-border',
        className
      )}
    >
      <img
        src={aiAvatar}
        alt="Open AI Assistant"
        className="h-full w-full object-cover"
      />
    </button>
  );
}
