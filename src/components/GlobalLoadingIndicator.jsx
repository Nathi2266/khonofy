import { useLocation } from 'react-router-dom';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useGlobalLoadingVisible } from '@/hooks/useGlobalLoading';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

export default function GlobalLoadingIndicator() {
  const location = useLocation();
  const visible = useGlobalLoadingVisible();
  const coverMainOnly = !AUTH_PATHS.has(location.pathname);

  if (!visible) {
    return null;
  }

  return <LoadingOverlay coverMainOnly={coverMainOnly} />;
}
