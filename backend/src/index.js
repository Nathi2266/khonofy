import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import {
  comparePassword,
  createResetToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from './lib/auth.js';
import {
  normalizeInput,
  parseDateOnly,
  parseDateTime,
  serializeMany,
  serializeRecord,
  toCamelCase,
} from './lib/serialize.js';

const app = express();

const RESOURCE_MAP = {
  users: { model: 'user', serialize: 'user' },
  tasks: { model: 'task', serialize: 'task' },
  'time-entries': { model: 'timeEntry', serialize: 'timeEntry' },
  timesheets: { model: 'timesheet', serialize: 'timesheet' },
  departments: { model: 'department', serialize: 'department' },
  tags: { model: 'tag', serialize: 'tag' },
  'task-templates': { model: 'taskTemplate', serialize: 'taskTemplate' },
  'activity-logs': { model: 'activityLog', serialize: 'activityLog' },
};

const DATE_ONLY_FIELDS = {
  task: new Set(['dueDate']),
  timeEntry: new Set(['date']),
  timesheet: new Set(['weekStart', 'weekEnd']),
};

const DATE_TIME_FIELDS = {
  user: new Set(['resetTokenExpiresAt']),
  timesheet: new Set(['submittedAt']),
};

function sendError(res, status, message) {
  return res.status(status).json({ message });
}

function resourceConfig(resource) {
  return RESOURCE_MAP[resource];
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  return token || null;
}

async function currentUserFromRequest(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  return user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await currentUserFromRequest(req);
    if (!user) return sendError(res, 401, 'Authentication required');
    req.authUser = user;
    return next();
  } catch {
    return sendError(res, 401, 'Authentication required');
  }
}

function isSuperuser(user) {
  return user?.role === 'superuser';
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function scopeWhere(resource, user) {
  if (isSuperuser(user)) return {};

  switch (resource) {
    case 'users':
      if (isAdmin(user) && user.departmentId) return { departmentId: user.departmentId };
      return { id: user.id };
    case 'tasks':
      if (isAdmin(user) && user.departmentId) return { departmentId: user.departmentId };
      return { OR: [{ assignedTo: user.id }, { createdById: user.id }] };
    case 'time-entries':
      if (isAdmin(user) && user.departmentId) return { departmentId: user.departmentId };
      return { userId: user.id };
    case 'timesheets':
      if (isAdmin(user) && user.departmentId) return { departmentId: user.departmentId };
      return { userId: user.id };
    case 'task-templates':
      return { userId: user.id };
    case 'activity-logs':
      if (isAdmin(user) && user.departmentId) return { departmentId: user.departmentId };
      return { userId: user.id };
    case 'departments':
      return {};
    case 'tags':
      return {};
    default:
      return {};
  }
}

function queryToWhere(resource, query) {
  const where = {};
  for (const [key, rawValue] of Object.entries(query)) {
    if (['sort', 'limit'].includes(key)) continue;
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    const camelKey = toCamelCase(key);
    const value = String(rawValue);

    if (DATE_ONLY_FIELDS[resource]?.has(camelKey)) {
      where[camelKey] = parseDateOnly(value);
      continue;
    }

    if (DATE_TIME_FIELDS[resource]?.has(camelKey)) {
      where[camelKey] = parseDateTime(value);
      continue;
    }

    if (value === 'true') {
      where[camelKey] = true;
      continue;
    }

    if (value === 'false') {
      where[camelKey] = false;
      continue;
    }

    if (!Number.isNaN(Number(value)) && value.trim() !== '') {
      where[camelKey] = Number(value);
      continue;
    }

    where[camelKey] = value;
  }
  return where;
}

function mergeWhere(scope, queryWhere) {
  const hasScope = scope && Object.keys(scope).length > 0;
  const hasQuery = queryWhere && Object.keys(queryWhere).length > 0;
  if (hasScope && hasQuery) return { AND: [scope, queryWhere] };
  return scope || queryWhere || {};
}

function sortToOrderBy(sort) {
  if (!sort) return undefined;
  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  const field = sort.replace(/^-/, '');
  const alias = {
    createdDate: 'createdAt',
    updatedDate: 'updatedAt',
  };
  return { [alias[toCamelCase(field)] || toCamelCase(field)]: direction };
}

function coerceDates(resource, payload) {
  const next = { ...payload };
  for (const field of DATE_ONLY_FIELDS[resource] || []) {
    if (typeof next[field] === 'string') next[field] = parseDateOnly(next[field]);
  }
  for (const field of DATE_TIME_FIELDS[resource] || []) {
    if (typeof next[field] === 'string') next[field] = parseDateTime(next[field]);
  }
  return next;
}

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} is required`);
  }
}

async function handleCreate(resource, user, body) {
  const cfg = resourceConfig(resource);
  const payload = coerceDates(cfg.model, normalizeInput(body));

  if (cfg.model === 'task') {
    required(payload.title, 'title');
    if (!isSuperuser(user) && !isAdmin(user)) {
      throw new Error('Forbidden');
    }
    payload.createdById = user.id;
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
  }

  if (cfg.model === 'timeEntry') {
    required(payload.userId, 'userId');
    required(payload.date, 'date');
    required(payload.hours, 'hours');
    if (!isSuperuser(user) && payload.userId !== user.id) throw new Error('Forbidden');
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
  }

  if (cfg.model === 'timesheet') {
    required(payload.userId, 'userId');
    required(payload.weekStart, 'weekStart');
    required(payload.weekEnd, 'weekEnd');
    if (!isSuperuser(user) && payload.userId !== user.id) throw new Error('Forbidden');
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
  }

  if (cfg.model === 'taskTemplate') {
    required(payload.userId, 'userId');
    if (!isSuperuser(user) && payload.userId !== user.id) throw new Error('Forbidden');
  }

  if (cfg.model === 'activityLog') {
    required(payload.userId, 'userId');
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
  }

  if (cfg.model === 'department' && !isSuperuser(user)) {
    throw new Error('Forbidden');
  }

  if (cfg.model === 'tag' && !(isSuperuser(user) || isAdmin(user))) {
    throw new Error('Forbidden');
  }

  if (cfg.model === 'user' && !isSuperuser(user)) {
    throw new Error('Forbidden');
  }

  const record = await prisma[cfg.model].create({ data: payload });
  return serializeRecord(cfg.serialize, record);
}

async function handleUpdate(resource, user, id, body) {
  const cfg = resourceConfig(resource);
  const existing = await prisma[cfg.model].findUnique({ where: { id } });
  if (!existing) return null;

  if (resource === 'tasks') {
    const canEdit =
      isSuperuser(user) ||
      (isAdmin(user) && (!user.departmentId || existing.departmentId === user.departmentId)) ||
      existing.assignedTo === user.id ||
      existing.createdById === user.id;
    if (!canEdit) throw new Error('Forbidden');
  }

  if (resource === 'time-entries' || resource === 'timesheets' || resource === 'task-templates' || resource === 'activity-logs') {
    const ownerField = {
      'time-entries': 'userId',
      timesheets: 'userId',
      'task-templates': 'userId',
      'activity-logs': 'userId',
    }[resource];
    const canEdit =
      isSuperuser(user) ||
      (isAdmin(user) && user.departmentId && existing.departmentId === user.departmentId) ||
      existing[ownerField] === user.id;
    if (!canEdit) throw new Error('Forbidden');
  }

  if (resource === 'departments' && !isSuperuser(user)) throw new Error('Forbidden');
  if (resource === 'tags' && !(isSuperuser(user) || isAdmin(user))) throw new Error('Forbidden');
  if (resource === 'users' && !isSuperuser(user)) throw new Error('Forbidden');
  if (resource === 'activity-logs' && !(isSuperuser(user) || existing.userId === user.id)) throw new Error('Forbidden');

  const payload = coerceDates(cfg.model, normalizeInput(body));
  const record = await prisma[cfg.model].update({ where: { id }, data: payload });
  return serializeRecord(cfg.serialize, record);
}

async function handleDelete(resource, user, id) {
  const cfg = resourceConfig(resource);
  const existing = await prisma[cfg.model].findUnique({ where: { id } });
  if (!existing) return null;

  if (!isSuperuser(user)) {
    if (resource === 'tasks') {
      const canDelete = isAdmin(user) && existing.departmentId === user.departmentId;
      if (!canDelete) throw new Error('Forbidden');
    } else if (resource === 'tags') {
      throw new Error('Forbidden');
    } else if (resource === 'departments') {
      throw new Error('Forbidden');
    } else if (resource === 'users') {
      throw new Error('Forbidden');
    } else {
      const ownerField = {
        'time-entries': 'userId',
        timesheets: 'userId',
        'task-templates': 'userId',
        'activity-logs': 'userId',
      }[resource];
      if (ownerField && existing[ownerField] !== user.id) throw new Error('Forbidden');
    }
  }

  const record = await prisma[cfg.model].delete({ where: { id } });
  return serializeRecord(cfg.serialize, record);
}

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone } = normalizeInput(req.body);
    required(email, 'email');
    required(password, 'password');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return sendError(res, 409, 'Email already registered');

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: fullName || '',
        phone: phone || '',
        role: 'staff',
      },
    });

    return res.status(201).json({
      access_token: signAccessToken(user),
      user: serializeRecord('user', user),
    });
  } catch (error) {
    return sendError(res, 400, error.message || 'Registration failed');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = normalizeInput(req.body);
    required(email, 'email');
    required(password, 'password');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 401, 'Invalid email or password');
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return sendError(res, 401, 'Invalid email or password');
    return res.json({
      access_token: signAccessToken(user),
      user: serializeRecord('user', user),
    });
  } catch (error) {
    return sendError(res, 400, error.message || 'Login failed');
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json(serializeRecord('user', req.authUser));
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const payload = normalizeInput(req.body);
    const updated = await prisma.user.update({
      where: { id: req.authUser.id },
      data: {
        phone: payload.phone ?? req.authUser.phone,
        fullName: payload.fullName ?? req.authUser.fullName,
      },
    });
    return res.json(serializeRecord('user', updated));
  } catch (error) {
    return sendError(res, 400, error.message || 'Update failed');
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = normalizeInput(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetToken = createResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashToken(resetToken),
          resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;
      console.log(`Password reset for ${email}: ${resetUrl}`);
    }
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, 400, error.message || 'Password reset request failed');
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = normalizeInput(req.body);
    required(resetToken, 'resetToken');
    required(newPassword, 'newPassword');
    const tokenHash = hashToken(resetToken);
    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });
    if (!user) return sendError(res, 400, 'Invalid or expired reset token');
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, 400, error.message || 'Password reset failed');
  }
});

app.get('/api/:resource', requireAuth, async (req, res) => {
  try {
    const { resource } = req.params;
    const cfg = resourceConfig(resource);
    if (!cfg) return sendError(res, 404, 'Unknown resource');

    const scope = scopeWhere(resource, req.authUser);
    const queryWhere = queryToWhere(cfg.model, req.query);
    const where = mergeWhere(scope, queryWhere);
    const orderBy = sortToOrderBy(req.query.sort);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const records = await prisma[cfg.model].findMany({
      where,
      orderBy,
      take: limit,
    });
    return res.json(serializeMany(cfg.serialize, records));
  } catch (error) {
    return sendError(res, 400, error.message || 'List failed');
  }
});

app.post('/api/:resource', requireAuth, async (req, res) => {
  try {
    const record = await handleCreate(req.params.resource, req.authUser, req.body);
    return res.status(201).json(record);
  } catch (error) {
    if (error.message === 'Forbidden') return sendError(res, 403, 'Forbidden');
    return sendError(res, 400, error.message || 'Create failed');
  }
});

app.get('/api/:resource/:id', requireAuth, async (req, res) => {
  try {
    const cfg = resourceConfig(req.params.resource);
    if (!cfg) return sendError(res, 404, 'Unknown resource');
    const scope = scopeWhere(req.params.resource, req.authUser);
    const record = await prisma[cfg.model].findUnique({ where: { id: req.params.id } });
    if (!record) return sendError(res, 404, 'Not found');
    const scoped = mergeWhere(scope, { id: record.id });
    if (Object.keys(scope).length > 0 && !req.authUser) return sendError(res, 403, 'Forbidden');
    if (!isSuperuser(req.authUser)) {
      const allowed = await prisma[cfg.model].count({ where: scoped });
      if (allowed === 0) return sendError(res, 403, 'Forbidden');
    }
    return res.json(serializeRecord(cfg.serialize, record));
  } catch (error) {
    return sendError(res, 400, error.message || 'Fetch failed');
  }
});

app.patch('/api/:resource/:id', requireAuth, async (req, res) => {
  try {
    const record = await handleUpdate(req.params.resource, req.authUser, req.params.id, req.body);
    if (!record) return sendError(res, 404, 'Not found');
    return res.json(record);
  } catch (error) {
    if (error.message === 'Forbidden') return sendError(res, 403, 'Forbidden');
    return sendError(res, 400, error.message || 'Update failed');
  }
});

app.delete('/api/:resource/:id', requireAuth, async (req, res) => {
  try {
    const record = await handleDelete(req.params.resource, req.authUser, req.params.id);
    if (!record) return sendError(res, 404, 'Not found');
    return res.json(record);
  } catch (error) {
    if (error.message === 'Forbidden') return sendError(res, 403, 'Forbidden');
    return sendError(res, 400, error.message || 'Delete failed');
  }
});

app.use((_req, res) => sendError(res, 404, 'Route not found'));

app.listen(env.port, '0.0.0.0', async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }

  console.log(`Backend running at http://localhost:${env.port}`);
  console.log(`Frontend should run at ${env.frontendUrl}`);
});
