import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { captureException } from '@/lib/sentry-client';

function shouldCaptureError(error) {
  if (!error) return false;
  if (error?.name === 'AbortError') return false;

  const status = Number(error?.status ?? error?.statusCode);
  if (Number.isFinite(status)) {
    if (status === 401 || status === 403) return false;
    if (status >= 500) return true;
    return status === 408 || status === 429;
  }

  return true;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const queryClientInstance = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!shouldCaptureError(error)) return;
      captureException(error, {
        tags: {
          area: 'react-query',
          kind: 'query',
        },
        extra: {
          queryKey: safeStringify(query?.queryKey),
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!shouldCaptureError(error)) return;
      captureException(error, {
        tags: {
          area: 'react-query',
          kind: 'mutation',
        },
        extra: {
          mutationKey: safeStringify(mutation?.options?.mutationKey),
        },
      });
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});