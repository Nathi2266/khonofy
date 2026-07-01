/** Extract a user-facing message from API / fetch errors. */
export function getApiErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  const data = error.response?.data ?? error.data;
  if (typeof data === 'string' && data) return data;
  if (data?.message) return data.message;

  const message = String(error.message || '');
  if (/failed to fetch|networkerror|load failed|err_failed/i.test(message)) {
    return 'Unable to reach the Khonofy API. The server may be starting or temporarily unavailable — please try again in a minute.';
  }

  if (message) return message;
  return fallback;
}
