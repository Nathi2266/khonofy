import * as Sentry from '@sentry/react';

const SENTRY_ENABLED = Boolean(import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN);

function markCaptured(error) {
  if (!error || typeof error !== 'object') return;
  try {
    // eslint-disable-next-line no-underscore-dangle
    error.__sentryCaptured = true;
  } catch {
    // ignore
  }
}

export function isSentryEnabled() {
  return SENTRY_ENABLED;
}

export function setUser(user) {
  if (!SENTRY_ENABLED) return;
  Sentry.setUser(user);
}

export function clearUser() {
  if (!SENTRY_ENABLED) return;
  Sentry.setUser(null);
}

export function setTag(key, value) {
  if (!SENTRY_ENABLED) return;
  if (!key) return;
  Sentry.setTag(String(key), value == null ? undefined : String(value));
}

export function setContext(name, context) {
  if (!SENTRY_ENABLED) return;
  if (!name) return;
  Sentry.setContext(String(name), context);
}

export function captureException(error, captureContext) {
  if (!SENTRY_ENABLED) return;
  if (!error) return;

  // eslint-disable-next-line no-underscore-dangle
  if (typeof error === 'object' && error.__sentryCaptured) return;

  markCaptured(error);
  Sentry.captureException(error, captureContext);
}

export function addBreadcrumb(breadcrumb) {
  if (!SENTRY_ENABLED) return;
  if (!breadcrumb) return;
  Sentry.addBreadcrumb(breadcrumb);
}

function shouldCaptureHttpStatus(status) {
  if (typeof status !== 'number') return false;
  if (status >= 500) return true;
  return status === 408 || status === 429;
}

export function captureApiError(error, { method, path, status, apiBase, hint } = {}) {
  if (!SENTRY_ENABLED) return;
  if (!error) return;

  if (error?.name === 'AbortError') return;

  // eslint-disable-next-line no-underscore-dangle
  if (typeof error === 'object' && error.__sentryCaptured) return;

  const isNetworkError = typeof status !== 'number';
  const shouldCapture = isNetworkError || shouldCaptureHttpStatus(status);
  if (!shouldCapture) return;

  addBreadcrumb({
    category: 'api',
    level: 'error',
    message: `${method || 'GET'} ${path || ''}${typeof status === 'number' ? ` (${status})` : ''}`,
    data: {
      method,
      path,
      status,
      apiBase,
      hint,
    },
  });

  captureException(error, {
    tags: {
      area: 'api',
      method: method ? String(method) : undefined,
      path: path ? String(path) : undefined,
      status: typeof status === 'number' ? String(status) : 'network_error',
      hint: hint ? String(hint) : undefined,
    },
    extra: {
      method,
      path,
      status,
      apiBase,
      hint,
    },
  });
}

