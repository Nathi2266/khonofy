/** Extract a user-facing message from API / fetch errors. */
export function getApiErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback;
  const data = error.response?.data ?? error.data;
  if (typeof data === 'string' && data) return data;
  if (data?.message) return data.message;
  if (error.message) return error.message;
  return fallback;
}
