import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/auth-storage';
import { beginRequest, endRequest } from '@/lib/loading-bus';

/**
 * Local Khonofy API (Express + PostgreSQL via DATABASE_URL).
 * Vite proxies /api → http://localhost:3001 in development.
 */
// @ts-ignore
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * @typedef {Record<string, string | number | boolean | null | undefined>} QueryParams
 * @typedef {{ method?: string, body?: unknown, query?: QueryParams, auth?: boolean, showGlobalLoader?: boolean }} RequestOptions
 * @typedef {Error & { status?: number, data?: unknown }} ApiError
 */

/**
 * @param {string} path
 * @param {QueryParams} [query]
 */
function buildUrl(path, query = {}) {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const queryString = search.toString();
  return `${base}${normalizedPath}${queryString ? `?${queryString}` : ''}`;
}

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 */
async function request(path, { method = 'GET', body, query, auth = true, showGlobalLoader = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  if (showGlobalLoader) beginRequest();

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const error = /** @type {ApiError} */ (new Error(
        typeof data === 'object' && data?.message ? data.message : data || 'Request failed'
      ));
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } finally {
    if (showGlobalLoader) endRequest();
  }
}

/**
 * @param {string | QueryParams | undefined} sortOrOptions
 * @param {number | undefined} limit
 * @returns {QueryParams}
 */
function normalizeQueryParams(sortOrOptions, limit) {
  if (sortOrOptions && typeof sortOrOptions === 'object' && !Array.isArray(sortOrOptions)) {
    return sortOrOptions;
  }

  /** @type {QueryParams} */
  const query = {};
  if (typeof sortOrOptions === 'string' && sortOrOptions) query.sort = sortOrOptions;
  if (typeof limit === 'number') query.limit = limit;
  return query;
}

/**
 * @param {string} resource
 * @returns {{
 *   list: (sortOrOptions?: string | QueryParams, limit?: number) => Promise<any>,
 *   filter: (filters?: QueryParams) => Promise<any>,
 *   create: (data: any) => Promise<any>,
 *   update: (id: string, data: any) => Promise<any>,
 *   delete: (id: string) => Promise<any>,
 * }}
 */
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

const calendar = {
  listEntries: (from, to, userId) =>
    request('/api/calendar/entries', {
      query: {
        from,
        to,
        user_id: userId,
      },
    }),
};

const ai = {
  chat: (messages) =>
    request('/api/ai/chat', {
      method: 'POST',
      body: { messages },
    }),
  logTicket: (ticketDraft) =>
    request('/api/ai/log-ticket', {
      method: 'POST',
      body: { ticketDraft },
    }),
  scanUserImport: (payload) =>
    request('/api/ai/scan-user-import', {
      method: 'POST',
      body: payload,
      showGlobalLoader: false,
    }),
};

const media = {
  imagekitAuth: () => request('/api/imagekit/auth'),
};

const auth = {
  loginViaEmailPassword: async (email, password) => {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setAuthToken(result.access_token);
    return result;
  },
  register: async ({ email, password, fullName, phone, full_name }) => {
    const result = await request('/api/auth/register', {
      method: 'POST',
      body: {
        email,
        password,
        fullName: fullName ?? full_name ?? '',
        phone: phone ?? '',
      },
      auth: false,
    });
    setAuthToken(result.access_token);
    return result;
  },
  me: () => request('/api/auth/me', { showGlobalLoader: false }),
  updateMe: (data) => request('/api/auth/me', { method: 'PATCH', body: data }),
  resetPasswordRequest: (email) =>
    request('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: ({ resetToken, newPassword }) =>
    request('/api/auth/reset-password', {
      method: 'POST',
      body: { resetToken, newPassword },
      auth: false,
    }),
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
  calendar,
  ai,
  media,
  entities: {
    User: createEntity('users'),
    Task: createEntity('tasks'),
    TimeEntry: createEntity('time-entries'),
    Timesheet: createEntity('timesheets'),
    Department: createEntity('departments'),
    Designation: createEntity('designations'),
    Client: createEntity('clients'),
    Project: createEntity('projects'),
    Tag: createEntity('tags'),
    TaskTemplate: createEntity('task-templates'),
    ActivityLog: createEntity('activity-logs'),
  },
};
