import { useEffect, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { subscribeLoading } from '@/lib/loading-bus';
import { useLoading } from '@/lib/LoadingContext';

export const GLOBAL_LOADING_MIN_MS = 3000;

export function useGlobalLoadingActive() {
  const mutatingCount = useIsMutating();
  const { loadingCount } = useLoading();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => subscribeLoading(setPendingRequests), []);

  return pendingRequests > 0 || mutatingCount > 0 || loadingCount > 0;
}

export function useGlobalLoadingVisible() {
  const isActive = useGlobalLoadingActive();
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef(0);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (!visible) {
        shownAtRef.current = Date.now();
        setVisible(true);
      }
      return undefined;
    }

    if (!visible) return undefined;

    const remaining = Math.max(0, GLOBAL_LOADING_MIN_MS - (Date.now() - shownAtRef.current));
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, remaining);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isActive, visible]);

  return visible;
}
