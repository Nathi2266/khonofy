import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/auth-storage';

const API_BASE = import.meta.env.VITE_API_URL || '';

function buildUrl(path, query = {}) {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const queryString = search.toString();
  return `${base}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
}

async function request(path, { method = 'GET', body, query, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(data?.message || data || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function normalizeQueryParams(sortOrOptions, limit) {
  if (sortOrOptions && typeof sortOrOptions === 'object' && !Array.isArray(sortOrOptions)) {
    return sortOrOptions;
  }

  const query = {};
  if (typeof sortOrOptions === 'string' && sortOrOptions) query.sort = sortOrOptions;
  if (typeof limit === 'number') query.limit = limit;
  return query;
}

function createEntity(resource) {
  const path = `/api/${resource}`;
  return {
    list: (sortOrOptions, limit) => request(path, { query: normalizeQueryParams(sortOrOptions, limit) }),
    filter: (filters = {}) => request(path, { query: filters }),
    create: (data) => request(path, { method: 'POST', body: data }),
    update: (id, data) => request(`${path}/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => request(`${path}/${id}`, { method: 'DELETE' }),
  };
}

const auth = {
  loginViaEmailPassword: async (email, password) => {
    const result = await request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
    setAuthToken(result.access_token);
    return result;
  },
  register: async ({ email, password, fullName, phone }) => {
    const result = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password, fullName, phone },
      auth: false,
    });
    setAuthToken(result.access_token);
    return result;
  },
  me: () => request('/api/auth/me'),
  updateMe: (data) => request('/api/auth/me', { method: 'PATCH', body: data }),
  resetPasswordRequest: (email) => request('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: ({ resetToken, newPassword }) => request('/api/auth/reset-password', { method: 'POST', body: { resetToken, newPassword }, auth: false }),
  logout: () => {
    clearAuthToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },
  redirectToLogin: () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },
  loginWithProvider: () => {
    throw new Error('OAuth sign-in is not enabled in this setup');
  },
  setToken: (token) => setAuthToken(token),
};

export const base44 = {
  auth,
  entities: {
    User: createEntity('users'),
    Task: createEntity('tasks'),
    TimeEntry: createEntity('time-entries'),
    Timesheet: createEntity('timesheets'),
    Department: createEntity('departments'),
    Tag: createEntity('tags'),
    TaskTemplate: createEntity('task-templates'),
    ActivityLog: createEntity('activity-logs'),
  },
};
