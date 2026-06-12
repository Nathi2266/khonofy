let pendingRequests = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener(pendingRequests));
}

export function getPendingRequestCount() {
  return pendingRequests;
}

export function beginRequest() {
  pendingRequests += 1;
  emit();
}

export function endRequest() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  emit();
}

export function subscribeLoading(listener) {
  listeners.add(listener);
  listener(pendingRequests);
  return () => {
    listeners.delete(listener);
  };
}
