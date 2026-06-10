import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { base44, isBase44Configured } from './lib/base44.js';
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
import { generateAssistantReply, generateVoiceTicketDraft, isAiConfigured, parseUsersFromImportDocument } from './lib/ai.js';

const app = express();

const RESOURCE_MAP = {
  users: { model: 'user', serialize: 'user' },
  tasks: { model: 'task', serialize: 'task' },
  'time-entries': { model: 'timeEntry', serialize: 'timeEntry' },
  timesheets: { model: 'timesheet', serialize: 'timesheet' },
  departments: { model: 'department', serialize: 'department' },
  designations: { model: 'designation', serialize: 'designation' },
  clients: { model: 'client', serialize: 'client' },
  projects: { model: 'project', serialize: 'project' },
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
  timeEntry: new Set(['startAt', 'endAt']),
  timesheet: new Set(['submittedAt']),
};

const ENTRY_MAX_DURATION_HOURS = 24;
const VALID_TASK_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

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

function normalizeNamedRecord(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function findUserByEmailAndPassword(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const matches = await prisma.user.findMany({ where: { email: normalizedEmail } });
  for (const user of matches) {
    const ok = await comparePassword(password, user.passwordHash);
    if (ok) return user;
  }
  return null;
}

function normalizeTaskPriority(value) {
  return VALID_TASK_PRIORITIES.has(value) ? value : 'medium';
}

async function assertUniqueNamedResource(model, name, ignoreId) {
  const normalizedName = normalizeNamedRecord(name);
  if (!normalizedName) throw new Error('Name is required');

  const existing = await prisma[model].findFirst({
    where: {
      name: {
        equals: normalizedName,
        mode: 'insensitive',
      },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
  });

  if (existing) {
    throw new Error(`${normalizedName} already exists`);
  }

  return normalizedName;
}

const NO_MATCH = { id: '__no_match__' };

async function getAssignedStaffIds(adminId) {
  const staff = await prisma.user.findMany({
    where: { adminId, role: 'staff' },
    select: { id: true },
  });
  return staff.map((s) => s.id);
}

async function assertAdminCanAssignStaff(admin, staffId, { previousAssignee = null } = {}) {
  if (!staffId) return;

  const staffUser = await prisma.user.findUnique({ where: { id: staffId } });
  if (!staffUser || staffUser.role !== 'staff') {
    throw new Error('Assigned user must be a staff member');
  }

  const staffIds = await getAssignedStaffIds(admin.id);
  if (staffIds.includes(staffId)) return;

  if (previousAssignee && previousAssignee === staffId) return;

  throw new Error('You can only assign tasks to staff on your team');
}

async function resolveTaskAssignee(payload) {
  if (!payload.assignedTo) {
    if (payload.assignedToName) payload.assignedToName = null;
    return;
  }

  const staffUser = await prisma.user.findUnique({ where: { id: payload.assignedTo } });
  if (!staffUser || staffUser.role !== 'staff') {
    throw new Error('Assigned user must be a staff member');
  }

  payload.assignedToName = staffUser.fullName || staffUser.email || payload.assignedToName || '';
}

async function validateUserAdminAssignment({ role, adminId }) {
  if (adminId === null || adminId === undefined || adminId === '') return;
  if (role !== 'staff') {
    throw new Error('Only staff users can be assigned to an admin');
  }
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== 'admin') {
    throw new Error('Assigned admin must be an admin user');
  }
}

async function assertStaffCanSubmitTimesheet(user) {
  if (user.role !== 'staff') return;

  const staffUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!staffUser?.adminId) {
    throw Object.assign(
      new Error('You cannot submit a timesheet until an admin has been assigned to you.'),
      { statusCode: 403 }
    );
  }
}

async function assertStaffMeetsHourTarget(user, totalHours) {
  if (user.role !== 'staff') return;

  const staffUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!staffUser?.departmentId) return;

  const department = await prisma.department.findUnique({ where: { id: staffUser.departmentId } });
  const target = Number(department?.weeklyHourTarget || 0);
  if (!target) return;

  if (Number(totalHours || 0) < target) {
    throw Object.assign(
      new Error(`You must log at least ${target}h before submitting this timesheet.`),
      { statusCode: 403 }
    );
  }
}

async function assertTimesheetWeekEditable(userId, date) {
  if (!userId || !date) return;

  const day = startOfDayUtc(date instanceof Date ? date : parseDateOnly(date));
  const timesheet = await prisma.timesheet.findFirst({
    where: {
      userId,
      weekStart: { lte: day },
      weekEnd: { gte: day },
      status: { in: ['approved', 'revoke_pending'] },
    },
  });

  if (timesheet) {
    const message = timesheet.status === 'revoke_pending'
      ? 'This calendar week is locked while your revocation request is waiting for admin approval.'
      : 'This calendar week is locked because your timesheet has been approved. Request a revocation to make changes.';
    throw Object.assign(new Error(message), { statusCode: 403 });
  }
}

const TIMESHEET_REVOKE_WINDOW_MS = 24 * 60 * 60 * 1000;

function getTimesheetReviewedAt(timesheet) {
  return timesheet.reviewedAt || timesheet.updatedAt || null;
}

function canStaffRevokeApprovedTimesheet(timesheet) {
  if (timesheet.status !== 'approved') return false;
  const reviewedAt = getTimesheetReviewedAt(timesheet);
  if (!reviewedAt) return false;
  return Date.now() - reviewedAt.getTime() <= TIMESHEET_REVOKE_WINDOW_MS;
}

async function maybeAdvanceTaskToInProgress(taskId, userId) {
  if (!taskId) return;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.assignedTo !== userId || task.status !== 'todo') return;
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'in_progress' },
  });
}

async function maybeCompleteTasksForPendingTimesheet(timesheetId, userId) {
  if (!timesheetId) return;
  const timesheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
  if (!timesheet || timesheet.status !== 'pending' || timesheet.userId !== userId) return;

  const entries = await prisma.timeEntry.findMany({
    where: { timesheetId, userId, taskId: { not: null } },
    select: { taskId: true },
  });
  const taskIds = [...new Set(entries.map((entry) => entry.taskId).filter(Boolean))];
  if (taskIds.length === 0) return;

  await prisma.task.updateMany({
    where: {
      id: { in: taskIds },
      assignedTo: userId,
      status: { in: ['todo', 'in_progress'] },
    },
    data: { status: 'completed' },
  });
}

async function applyStaffTimesheetStatusChange(existing, payload, user) {
  if (user.role !== 'staff' || existing.userId !== user.id || payload.status === undefined) {
    return payload;
  }

  const nextStatus = payload.status;
  if (nextStatus === existing.status) return payload;

  if (existing.status === 'pending' && nextStatus === 'draft') {
    return {
      ...payload,
      submittedAt: null,
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      adminNotes: null,
      withdrawnAt: new Date(),
    };
  }

  if (existing.status === 'approved' && nextStatus === 'revoke_pending') {
    if (!canStaffRevokeApprovedTimesheet(existing)) {
      throw Object.assign(
        new Error('You can only request revocation of an approved timesheet within 1 day of approval.'),
        { statusCode: 403 }
      );
    }

    return {
      ...payload,
      revokeRequestedAt: new Date(),
    };
  }

  if (
    (existing.status === 'draft' && nextStatus === 'pending')
    || (existing.status === 'rejected' && nextStatus === 'pending')
  ) {
    return payload;
  }

  throw Object.assign(new Error('Forbidden timesheet status change'), { statusCode: 403 });
}

async function applyAdminTimesheetStatusChange(existing, payload, user) {
  if (!(isAdmin(user) || isSuperuser(user)) || payload.status === undefined) {
    return payload;
  }

  if (existing.status !== 'revoke_pending') return payload;

  if (payload.status === 'draft') {
    return {
      ...payload,
      submittedAt: null,
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      adminNotes: null,
      revokeRequestedAt: null,
      revokedAt: new Date(),
    };
  }

  if (payload.status === 'approved') {
    return {
      ...payload,
      revokeRequestedAt: null,
    };
  }

  return payload;
}

async function scopeWhere(resource, user) {
  if (isSuperuser(user)) return {};

  if (isAdmin(user)) {
    const staffIds = await getAssignedStaffIds(user.id);
    switch (resource) {
      case 'users':
        return { OR: [{ id: user.id }, { adminId: user.id }] };
      case 'tasks':
        return staffIds.length
          ? { OR: [{ assignedTo: { in: staffIds } }, { createdById: user.id }] }
          : { createdById: user.id };
      case 'time-entries':
      case 'timesheets':
      case 'activity-logs':
        return staffIds.length ? { userId: { in: staffIds } } : NO_MATCH;
      case 'departments':
      case 'designations':
      case 'clients':
        return {};
      case 'projects':
        if (user.departmentId) {
          return {
            OR: [
              { departmentId: user.departmentId },
              { departmentId: null },
            ],
          };
        }
        return {};
      case 'tags':
        return {};
      default:
        return {};
    }
  }

  switch (resource) {
    case 'users':
      return { id: user.id };
    case 'tasks':
      return { OR: [{ assignedTo: user.id }, { createdById: user.id }] };
    case 'time-entries':
      return { userId: user.id };
    case 'timesheets':
      return { userId: user.id };
    case 'task-templates':
      return { userId: user.id };
    case 'activity-logs':
      return { userId: user.id };
    case 'departments':
    case 'designations':
    case 'clients':
      return {};
    case 'projects':
      if (user?.role === 'staff') {
        return { isActive: true };
      }
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

async function activeProjectWhereForUser(user) {
  return mergeWhere(await scopeWhere('projects', user), { isActive: true });
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

function normalizeSouthAfricanPhone(value) {
  if (value === undefined || value === null || value === '') return value;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return `+27${digits}`;
}

function buildImageKitAuth() {
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 60 * 30;
  const signature = crypto
    .createHmac('sha1', env.imagekitPrivateKey)
    .update(`${token}${expire}`)
    .digest('hex');

  return {
    token,
    expire,
    signature,
    publicKey: env.imagekitPublicKey,
    urlEndpoint: env.imagekitUrlEndpoint,
  };
}

function combineDateAndHour(dateValue, hourValue = 0) {
  const date = dateValue instanceof Date ? new Date(dateValue) : parseDateOnly(dateValue);
  const numericHour = Number(hourValue || 0);
  const hours = Math.trunc(numericHour);
  const minutes = Math.round((numericHour - hours) * 60);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

function startOfDayUtc(value) {
  const date = value instanceof Date ? new Date(value) : parseDateOnly(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function diffHours(startAt, endAt) {
  return (endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000);
}

function roundToQuarter(value) {
  return Math.round(value * 4) / 4;
}

function deriveTimeEntryFields(payload) {
  const next = { ...payload };

  if (next.startAt && !next.endAt && next.hours !== undefined) {
    next.endAt = new Date(next.startAt.getTime() + Number(next.hours) * 60 * 60 * 1000);
  }

  if (!next.startAt && next.date && next.startHour !== undefined) {
    next.startAt = combineDateAndHour(next.date, next.startHour);
  }

  if (!next.endAt && next.startAt && next.hours !== undefined) {
    next.endAt = new Date(next.startAt.getTime() + Number(next.hours) * 60 * 60 * 1000);
  }

  if (next.startAt && next.endAt) {
    const durationHours = diffHours(next.startAt, next.endAt);
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      throw new Error('endAt must be after startAt');
    }
    if (durationHours > ENTRY_MAX_DURATION_HOURS) {
      throw new Error(`Time entry cannot exceed ${ENTRY_MAX_DURATION_HOURS} hours`);
    }
    next.date = startOfDayUtc(next.startAt);
    next.startHour = roundToQuarter(next.startAt.getUTCHours() + next.startAt.getUTCMinutes() / 60);
    next.hours = roundToQuarter(durationHours);
  }

  if (next.hours !== undefined) {
    next.hours = Number(next.hours);
  }

  if (next.startHour !== undefined && next.startHour !== null) {
    next.startHour = Number(next.startHour);
  }

  return next;
}

async function assignDefaultTimeEntryWindow(payload, ignoreId = null) {
  if (payload.startAt || payload.endAt || !payload.userId || !payload.date || payload.hours === undefined) {
    return payload;
  }

  const durationHours = Number(payload.hours);
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    throw new Error('hours is required');
  }

  const dayStart = startOfDayUtc(payload.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const latestEntry = await prisma.timeEntry.findFirst({
    where: {
      userId: payload.userId,
      id: ignoreId ? { not: ignoreId } : undefined,
      startAt: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { endAt: 'desc' },
  });

  const startAt = latestEntry?.endAt
    ? new Date(latestEntry.endAt)
    : combineDateAndHour(dayStart, 9);
  const endAt = new Date(startAt.getTime() + durationHours * 60 * 60 * 1000);

  if (endAt > dayEnd) {
    throw new Error('No available time slot remains on this day');
  }

  return deriveTimeEntryFields({
    ...payload,
    startAt,
    endAt,
  });
}

async function validateProjectAndClient(payload) {
  if (payload.clientId) {
    const client = await prisma.client.findUnique({ where: { id: payload.clientId } });
    if (!client || !client.isActive) throw new Error('Selected client is not available');
    payload.clientName = client.name;
  } else if (payload.clientName === '') {
    payload.clientName = null;
  }

  if (payload.projectId) {
    const project = await prisma.project.findUnique({ where: { id: payload.projectId } });
    if (!project || !project.isActive) throw new Error('Selected project is not available');
    payload.projectName = project.name;
    payload.clientId = project.clientId || payload.clientId || null;
    payload.clientName = project.clientName || payload.clientName || null;
    if (payload.billable === undefined) {
      payload.billable = project.isBillableDefault;
    }
    if (!payload.departmentId && project.departmentId) {
      payload.departmentId = project.departmentId;
    }
  } else if (payload.projectName === '' || payload.projectId === '') {
    payload.projectId = null;
    payload.projectName = null;
  }
}

const TASK_DATA_FIELDS = new Set([
  'title',
  'description',
  'dueDate',
  'priority',
  'status',
  'assignedTo',
  'assignedToName',
  'projectId',
  'projectName',
  'departmentId',
  'estimatedHours',
  'createdById',
]);

function emptyToNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function sanitizeTaskPayload(payload) {
  const next = { ...payload };

  for (const field of ['description', 'assignedTo', 'assignedToName', 'projectId', 'projectName', 'departmentId', 'createdById']) {
    if (field in next) next[field] = emptyToNull(next[field]);
  }

  if (next.estimatedHours === '' || next.estimatedHours === undefined || next.estimatedHours === null) {
    next.estimatedHours = null;
  } else {
    const hours = Number(next.estimatedHours);
    next.estimatedHours = Number.isFinite(hours) ? hours : null;
  }

  if (next.dueDate === '') next.dueDate = null;

  delete next.clientId;
  delete next.clientName;
  delete next.billable;

  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => TASK_DATA_FIELDS.has(key) && value !== undefined)
  );
}

async function listAiProjectsForUser(user) {
  return prisma.project.findMany({
    where: await activeProjectWhereForUser(user),
    orderBy: { name: 'asc' },
    take: 20,
  });
}

async function resolveAiProject(user, ticketDraft) {
  const requestedProjectId = normalizeNamedRecord(ticketDraft?.projectId || '');
  const requestedProjectName = normalizeNamedRecord(ticketDraft?.projectName || '');

  if (!requestedProjectId && !requestedProjectName) return null;

  const lookupWhere = requestedProjectId
    ? { id: requestedProjectId }
    : {
        name: {
          equals: requestedProjectName,
          mode: 'insensitive',
        },
      };

  const project = await prisma.project.findFirst({
    where: mergeWhere(await activeProjectWhereForUser(user), lookupWhere),
  });

  if (!project) {
    throw new Error('Selected project is not available for this user');
  }

  return project;
}

async function createTaskFromAiTicket(user, ticketDraft) {
  const title = normalizeNamedRecord(ticketDraft?.title);
  const description = normalizeNamedRecord(ticketDraft?.description);
  const timeframeLabel = normalizeNamedRecord(ticketDraft?.timeframeLabel);
  const dueDate = ticketDraft?.dueDate ? parseDateOnly(ticketDraft.dueDate) : undefined;
  const estimatedHours = Number(ticketDraft?.estimatedHours);

  required(title, 'title');
  required(description, 'description');
  if (!dueDate && !timeframeLabel) {
    throw new Error('A ticket timeframe is required');
  }

  const project = await resolveAiProject(user, ticketDraft);

  const payload = {
    title,
    description: timeframeLabel ? `${description}\n\nTimeframe: ${timeframeLabel}` : description,
    dueDate,
    priority: normalizeTaskPriority(ticketDraft?.priority),
    status: 'todo',
    assignedTo: user.id,
    assignedToName: user.fullName || user.email || '',
    estimatedHours: Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : undefined,
    projectId: project?.id || undefined,
    projectName: project?.name || undefined,
    departmentId: project?.departmentId || user.departmentId || undefined,
    createdById: user.id,
  };

  await validateProjectAndClient(payload);
  const record = await prisma.task.create({ data: payload });
  await writeActivityLog(
    user,
    'Created ticket via AI',
    'Task',
    record.id,
    `Logged "${record.title}" from the AI assistant`,
    record.departmentId
  );
  return record;
}

async function ensureEditableTimeEntry(existing) {
  return existing;
}

async function assertNoTimeEntryOverlap(payload, ignoreId = null) {
  return { payload, ignoreId };
}

async function writeActivityLog(user, action, entityType, entityId, details, departmentId) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        userName: user.fullName || user.email || 'Unknown',
        action,
        entityType,
        entityId,
        details,
        departmentId: departmentId || user.departmentId || null,
      },
    });
  } catch {
    // Never block main flows on audit persistence.
  }
}

function describeEntryChange(existing, payload) {
  const beforeStart = existing.startAt?.toISOString() || '';
  const beforeEnd = existing.endAt?.toISOString() || '';
  const afterStart = payload.startAt?.toISOString() || beforeStart;
  const afterEnd = payload.endAt?.toISOString() || beforeEnd;

  if (beforeStart !== afterStart && beforeEnd === afterEnd) {
    return { action: 'Entry Moved', details: `Moved "${existing.taskTitle || payload.taskTitle || 'Time Entry'}" to ${afterStart}` };
  }

  if (beforeStart === afterStart && beforeEnd !== afterEnd) {
    return { action: 'Entry Resized', details: `Resized "${existing.taskTitle || payload.taskTitle || 'Time Entry'}" to ${roundToQuarter(diffHours(payload.startAt, payload.endAt))}h` };
  }

  return { action: 'Entry Updated', details: `Updated "${existing.taskTitle || payload.taskTitle || 'Time Entry'}"` };
}

async function resolveTimesheetForEntry({ userId, date, timesheetId }, fallbackTimesheetId = null) {
  if (timesheetId !== undefined) {
    if (!timesheetId) return null;
    const explicitSheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
    if (explicitSheet) return explicitSheet;
  }

  if (userId && date) {
    const day = startOfDayUtc(date);
    const matchingSheet = await prisma.timesheet.findFirst({
      where: {
        userId,
        weekStart: { lte: day },
        weekEnd: { gte: day },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (matchingSheet) return matchingSheet;
  }

  if (fallbackTimesheetId) {
    return prisma.timesheet.findUnique({ where: { id: fallbackTimesheetId } });
  }

  return null;
}

async function refreshTimesheetTotals(timesheetId) {
  if (!timesheetId) return null;

  const timesheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
  if (!timesheet) return null;

  const linkedEntries = await prisma.timeEntry.findMany({
    where: { timesheetId },
  });
  const totalHours = linkedEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const reopen = timesheet.status === 'approved' || timesheet.status === 'rejected';

  return prisma.timesheet.update({
    where: { id: timesheetId },
    data: {
      totalHours,
      ...(reopen
        ? {
            status: 'pending',
            submittedAt: new Date(),
            reviewedBy: null,
            reviewedByName: null,
            adminNotes: null,
          }
        : {}),
    },
  });
}

async function handleCreate(resource, user, body) {
  const cfg = resourceConfig(resource);
  let payload = coerceDates(cfg.model, normalizeInput(body));

  if (cfg.model === 'task') {
    required(payload.title, 'title');
    if (!isSuperuser(user) && !isAdmin(user)) {
      throw new Error('Forbidden');
    }
    if (isAdmin(user) && payload.assignedTo) {
      await assertAdminCanAssignStaff(user, payload.assignedTo);
    }
    if (payload.assignedTo) {
      await resolveTaskAssignee(payload);
    }
    payload.createdById = user.id;
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
    await validateProjectAndClient(payload);
    payload = sanitizeTaskPayload(payload);
  }

  if (cfg.model === 'timeEntry') {
    required(payload.userId, 'userId');
    if (!isSuperuser(user) && payload.userId !== user.id) throw new Error('Forbidden');
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
    const normalizedEntry = await assignDefaultTimeEntryWindow(deriveTimeEntryFields(payload));
    const linkedTimesheet = await resolveTimesheetForEntry({
      userId: normalizedEntry.userId,
      date: normalizedEntry.date,
      timesheetId: Object.prototype.hasOwnProperty.call(payload, 'timesheetId') ? payload.timesheetId : undefined,
    });
    if (linkedTimesheet) {
      normalizedEntry.timesheetId = linkedTimesheet.id;
    }
    required(normalizedEntry.startAt, 'startAt');
    required(normalizedEntry.endAt, 'endAt');
    if (user.role === 'staff') {
      await assertTimesheetWeekEditable(normalizedEntry.userId, normalizedEntry.date);
    }
    await validateProjectAndClient(normalizedEntry);
    await assertNoTimeEntryOverlap(normalizedEntry);
    const record = await prisma[cfg.model].create({ data: normalizedEntry });
    await refreshTimesheetTotals(record.timesheetId);
    if (user.role === 'staff') {
      await maybeAdvanceTaskToInProgress(record.taskId, user.id);
      await maybeCompleteTasksForPendingTimesheet(record.timesheetId, user.id);
    }
    await writeActivityLog(
      user,
      'Entry Created',
      'TimeEntry',
      record.id,
      `Created "${record.taskTitle || 'Time Entry'}" from ${record.startAt?.toISOString() || ''} to ${record.endAt?.toISOString() || ''}`,
      record.departmentId
    );
    return serializeRecord(cfg.serialize, record);
  }

  if (cfg.model === 'timesheet') {
    required(payload.userId, 'userId');
    required(payload.weekStart, 'weekStart');
    required(payload.weekEnd, 'weekEnd');
    if (!isSuperuser(user) && payload.userId !== user.id) throw new Error('Forbidden');
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
    if (!isSuperuser(user) && payload.status === 'pending') {
      await assertStaffCanSubmitTimesheet(user);
      await assertStaffMeetsHourTarget(user, payload.totalHours);
    }
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

  if (cfg.model === 'designation' && !isSuperuser(user)) {
    throw new Error('Forbidden');
  }

  if (cfg.model === 'client' && !isSuperuser(user)) {
    throw new Error('Forbidden');
  }

  if (cfg.model === 'project' && !(isSuperuser(user) || isAdmin(user))) {
    throw new Error('Forbidden');
  }

  if (cfg.model === 'tag' && !(isSuperuser(user) || isAdmin(user))) {
    throw new Error('Forbidden');
  }

  if (cfg.model === 'user' && !isSuperuser(user)) {
    throw new Error('Forbidden');
  }

  if (cfg.model === 'user') {
    required(payload.email, 'email');
    required(payload.password, 'password');
    payload.passwordHash = await hashPassword(payload.password);
    delete payload.password;
    const role = payload.role || 'staff';
    if (role !== 'staff') {
      delete payload.adminId;
    } else if (payload.adminId) {
      await validateUserAdminAssignment({ role, adminId: payload.adminId });
    }
  }

  if (cfg.model === 'project') {
    await validateProjectAndClient(payload);
    if (!payload.departmentId && user.departmentId) payload.departmentId = user.departmentId;
  }

  if (cfg.model === 'department' || cfg.model === 'designation') {
    payload.name = await assertUniqueNamedResource(cfg.model, payload.name);
  }

  const record = await prisma[cfg.model].create({ data: payload });
  if (cfg.model === 'timesheet' && user.role === 'staff' && record.status === 'pending') {
    await maybeCompleteTasksForPendingTimesheet(record.id, user.id);
  }
  return serializeRecord(cfg.serialize, record);
}

async function handleUpdate(resource, user, id, body) {
  const cfg = resourceConfig(resource);
  const existing = await prisma[cfg.model].findUnique({ where: { id } });
  if (!existing) return null;

  const staffIds = isAdmin(user) ? await getAssignedStaffIds(user.id) : [];

  if (resource === 'tasks') {
    const canEdit =
      isSuperuser(user) ||
      (isAdmin(user) && staffIds.includes(existing.assignedTo)) ||
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
      (isAdmin(user) && staffIds.includes(existing[ownerField])) ||
      existing[ownerField] === user.id;
    if (!canEdit) throw new Error('Forbidden');
  }

  if (resource === 'departments' && !(isSuperuser(user) || (isAdmin(user) && existing.id === user.departmentId))) {
    throw new Error('Forbidden');
  }
  if (resource === 'designations' && !isSuperuser(user)) throw new Error('Forbidden');
  if (resource === 'clients' && !isSuperuser(user)) throw new Error('Forbidden');
  if (resource === 'projects' && !(isSuperuser(user) || isAdmin(user))) throw new Error('Forbidden');
  if (resource === 'tags' && !(isSuperuser(user) || isAdmin(user))) throw new Error('Forbidden');
  if (resource === 'users' && !isSuperuser(user)) throw new Error('Forbidden');
  if (resource === 'activity-logs' && !(isSuperuser(user) || existing.userId === user.id)) throw new Error('Forbidden');

  let payload = coerceDates(cfg.model, normalizeInput(body));
  if (cfg.model === 'task') {
    if (isAdmin(user) && payload.assignedTo) {
      await assertAdminCanAssignStaff(user, payload.assignedTo, { previousAssignee: existing.assignedTo });
    }
    if (payload.assignedTo !== undefined) {
      await resolveTaskAssignee(payload);
    }
    await validateProjectAndClient(payload);
    payload = sanitizeTaskPayload(payload);
    if (user.role === 'staff') {
      delete payload.status;
    }
  }

  if (cfg.model === 'project') {
    await validateProjectAndClient(payload);
  }

  if (cfg.model === 'user') {
    if (payload.password) {
      payload.passwordHash = await hashPassword(payload.password);
      delete payload.password;
    }
    const nextRole = payload.role !== undefined ? payload.role : existing.role;
    if (nextRole !== 'staff') {
      payload.adminId = null;
    } else if (payload.adminId !== undefined) {
      await validateUserAdminAssignment({ role: nextRole, adminId: payload.adminId });
    } else if (payload.role === 'staff' && existing.adminId) {
      await validateUserAdminAssignment({ role: nextRole, adminId: existing.adminId });
    }
  }

  if ((cfg.model === 'department' || cfg.model === 'designation') && payload.name !== undefined) {
    payload.name = await assertUniqueNamedResource(cfg.model, payload.name, id);
  }

  if (cfg.model === 'department' && isAdmin(user) && !isSuperuser(user)) {
    payload = {
      weeklyHourTarget: payload.weeklyHourTarget ?? null,
    };
  }

  if (cfg.model === 'timesheet') {
    const nextStatus = payload.status !== undefined ? payload.status : existing.status;
    if (!isSuperuser(user) && nextStatus === 'pending' && existing.status !== 'pending') {
      await assertStaffCanSubmitTimesheet(user);
      const totalHours = payload.totalHours !== undefined ? payload.totalHours : existing.totalHours;
      await assertStaffMeetsHourTarget(user, totalHours);
    }

    if ((isAdmin(user) || isSuperuser(user)) && payload.status !== undefined) {
      if (
        (payload.status === 'approved' || payload.status === 'rejected')
        && existing.status !== 'revoke_pending'
      ) {
        payload.reviewedAt = payload.reviewedAt || new Date();
      }
    }

    if (user.role === 'staff' && existing.userId === user.id) {
      payload = await applyStaffTimesheetStatusChange(existing, payload, user);
    }

    if (isAdmin(user) || isSuperuser(user)) {
      payload = await applyAdminTimesheetStatusChange(existing, payload, user);
    }
  }

  if (cfg.model === 'timeEntry') {
    const previousTimesheetId = existing.timesheetId;
    const normalizedEntry = await assignDefaultTimeEntryWindow(deriveTimeEntryFields({
      ...existing,
      ...payload,
    }), id);
    const hasTimesheetOverride = Object.prototype.hasOwnProperty.call(payload, 'timesheetId');
    const dateChanged = existing.date?.toISOString() !== normalizedEntry.date?.toISOString();
    if (user.role === 'staff') {
      await assertTimesheetWeekEditable(existing.userId, normalizedEntry.date);
    }
    const linkedTimesheet = await resolveTimesheetForEntry(
      {
        userId: normalizedEntry.userId,
        date: normalizedEntry.date,
        timesheetId: hasTimesheetOverride ? payload.timesheetId : undefined,
      },
      hasTimesheetOverride || dateChanged ? null : previousTimesheetId
    );
    normalizedEntry.timesheetId = linkedTimesheet?.id || null;
    await validateProjectAndClient(normalizedEntry);
    await assertNoTimeEntryOverlap(normalizedEntry, id);
    const record = await prisma[cfg.model].update({ where: { id }, data: normalizedEntry });
    if (previousTimesheetId && previousTimesheetId !== record.timesheetId) {
      await refreshTimesheetTotals(previousTimesheetId);
    }
    await refreshTimesheetTotals(record.timesheetId);
    if (user.role === 'staff') {
      await maybeAdvanceTaskToInProgress(record.taskId, user.id);
      await maybeCompleteTasksForPendingTimesheet(record.timesheetId, user.id);
    }
    const change = describeEntryChange(existing, normalizedEntry);
    await writeActivityLog(user, change.action, 'TimeEntry', record.id, change.details, record.departmentId);
    return serializeRecord(cfg.serialize, record);
  }

  if (cfg.model === 'timesheet') {
    const nextStatus = payload.status !== undefined ? payload.status : existing.status;
    const record = await prisma[cfg.model].update({ where: { id }, data: payload });
    if (
      user.role === 'staff'
      && existing.userId === user.id
      && nextStatus === 'pending'
      && existing.status !== 'pending'
    ) {
      await maybeCompleteTasksForPendingTimesheet(record.id, user.id);
    }
    return serializeRecord(cfg.serialize, record);
  }

  const record = await prisma[cfg.model].update({ where: { id }, data: payload });
  return serializeRecord(cfg.serialize, record);
}

async function handleDelete(resource, user, id) {
  const cfg = resourceConfig(resource);
  const existing = await prisma[cfg.model].findUnique({ where: { id } });
  if (!existing) return null;

  if (!isSuperuser(user)) {
    const staffIds = isAdmin(user) ? await getAssignedStaffIds(user.id) : [];
    if (resource === 'tasks') {
      const canDelete = isAdmin(user) && staffIds.includes(existing.assignedTo);
      if (!canDelete) throw new Error('Forbidden');
    } else if (resource === 'tags') {
      throw new Error('Forbidden');
    } else if (resource === 'departments') {
      throw new Error('Forbidden');
    } else if (resource === 'designations') {
      throw new Error('Forbidden');
    } else if (resource === 'clients') {
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

  if (resource === 'projects' && !(isSuperuser(user) || isAdmin(user))) {
    throw new Error('Forbidden');
  }

  if (resource === 'time-entries') {
    if (user.role === 'staff') {
      await assertTimesheetWeekEditable(existing.userId, existing.date);
    }
    const previousTimesheetId = existing.timesheetId;
    const record = await prisma[cfg.model].delete({ where: { id } });
    if (previousTimesheetId) {
      await refreshTimesheetTotals(previousTimesheetId);
    }
    await writeActivityLog(
      user,
      'Entry Deleted',
      'TimeEntry',
      record.id,
      `Deleted "${record.taskTitle || 'Time Entry'}"`,
      record.departmentId
    );
    return serializeRecord(cfg.serialize, record);
  }

  const record = await prisma[cfg.model].delete({ where: { id } });
  return serializeRecord(cfg.serialize, record);
}

app.use(
  cors({
    origin:
      env.nodeEnv === 'development'
        ? (origin, callback) => {
            if (
              !origin ||
              /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
            ) {
              callback(null, true);
              return;
            }
            callback(null, env.frontendUrl);
          }
        : env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/debug/sentry-test', (_req, _res) => {
  throw new Error('Khonofy backend Sentry connectivity test');
});

app.get('/health/base44', async (_req, res) => {
  if (!isBase44Configured()) {
    return res.status(503).json({
      ok: false,
      configured: false,
      message: 'Set BASE44_APP_ID and BASE44_API_KEY in backend/.env',
    });
  }

  try {
    await base44.entities.User.list(undefined, 1);
    return res.json({ ok: true, configured: true });
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'Base44 request failed';
    return res.status(502).json({ ok: false, configured: true, message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone } = normalizeInput(req.body);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    required(normalizedEmail, 'email');
    required(password, 'password');

    const existing = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (existing) return sendError(res, 409, 'Email already registered');

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: fullName || '',
        phone: normalizeSouthAfricanPhone(phone) || '',
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
    const normalizedEmail = String(email || '').trim().toLowerCase();
    required(normalizedEmail, 'email');
    required(password, 'password');
    const user = await findUserByEmailAndPassword(normalizedEmail, password);
    if (!user) return sendError(res, 401, 'Invalid email or password');
    return res.json({
      access_token: signAccessToken(user),
      user: serializeRecord('user', user),
    });
  } catch (error) {
    console.error('Login failed:', error);
    return sendError(res, 400, 'Login failed. Please try again.');
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const serialized = serializeRecord('user', req.authUser);
  if (req.authUser.adminId) {
    const admin = await prisma.user.findUnique({ where: { id: req.authUser.adminId } });
    if (admin) {
      serialized.admin_name = admin.fullName || admin.email;
    }
  }
  return res.json(serialized);
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const payload = normalizeInput(req.body);
    const updated = await prisma.user.update({
      where: { id: req.authUser.id },
      data: {
        phone: payload.phone !== undefined ? normalizeSouthAfricanPhone(payload.phone) : req.authUser.phone,
        fullName: payload.fullName !== undefined ? normalizeNamedRecord(payload.fullName) : req.authUser.fullName,
        profileImageUrl: payload.profileImageUrl !== undefined ? payload.profileImageUrl : req.authUser.profileImageUrl,
        profileImagePath: payload.profileImagePath !== undefined ? payload.profileImagePath : req.authUser.profileImagePath,
        departmentId: payload.departmentId !== undefined ? payload.departmentId : req.authUser.departmentId,
        designationId: payload.designationId !== undefined ? payload.designationId : req.authUser.designationId,
      },
    });
    return res.json(serializeRecord('user', updated));
  } catch (error) {
    return sendError(res, 400, error.message || 'Update failed');
  }
});

app.get('/api/imagekit/auth', requireAuth, async (_req, res) => {
  try {
    if (!env.imagekitPublicKey || !env.imagekitPrivateKey || !env.imagekitUrlEndpoint) {
      return sendError(res, 503, 'ImageKit is not configured');
    }

    return res.json(buildImageKitAuth());
  } catch (error) {
    return sendError(res, 400, error.message || 'ImageKit auth failed');
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = normalizeInput(req.body);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
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
      console.log(`Password reset for ${normalizedEmail}: ${resetUrl}`);
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

app.post('/api/ai/chat', requireAuth, async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return sendError(res, 503, 'AI assistant is not configured');
    }

    const payload = normalizeInput(req.body);
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const projects = await listAiProjectsForUser(req.authUser);
    const response = await generateAssistantReply({
      user: req.authUser,
      messages,
      projects,
    });

    return res.json(response);
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message || 'AI request failed');
  }
});

app.post('/api/ai/voice-ticket', requireAuth, async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return sendError(res, 503, 'AI assistant is not configured');
    }

    const payload = normalizeInput(req.body);
    const transcript = String(payload.transcript || '').trim();
    if (!transcript) {
      return sendError(res, 400, 'Voice note is empty');
    }

    const projects = await listAiProjectsForUser(req.authUser);
    const response = await generateVoiceTicketDraft({
      user: req.authUser,
      transcript,
      projects,
    });

    return res.json(response);
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message || 'Voice ticket generation failed');
  }
});

app.post('/api/ai/log-ticket', requireAuth, async (req, res) => {
  try {
    const payload = normalizeInput(req.body);
    const task = await createTaskFromAiTicket(req.authUser, payload.ticketDraft || {});
    return res.status(201).json(serializeRecord('task', task));
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message || 'Ticket logging failed');
  }
});

app.post('/api/ai/scan-user-import', requireAuth, async (req, res) => {
  try {
    if (!isSuperuser(req.authUser)) {
      return sendError(res, 403, 'Forbidden');
    }
    if (!isAiConfigured()) {
      return sendError(res, 503, 'AI assistant is not configured');
    }

    const payload = normalizeInput(req.body);
    const text = String(payload.text || '').trim();
    const fileName = String(payload.fileName || '').trim();
    const imageBase64 = String(payload.imageBase64 || '').trim();
    const imageMimeType = String(payload.imageMimeType || '').trim();

    if (!text && !imageBase64) {
      return sendError(res, 400, 'Document content is required');
    }

    const result = await parseUsersFromImportDocument({
      text,
      fileName,
      imageBase64,
      imageMimeType,
    });
    return res.json(result);
  } catch (error) {
    return sendError(res, error.statusCode || 400, error.message || 'AI document scan failed');
  }
});

app.get('/api/calendar/entries', requireAuth, async (req, res) => {
  try {
    const { from, to, user_id: requestedUserId } = normalizeInput(req.query);
    required(from, 'from');
    required(to, 'to');

    const fromDate = parseDateTime(from);
    const toDate = parseDateTime(to);
    if (!(fromDate instanceof Date) || Number.isNaN(fromDate.getTime())) {
      throw new Error('Invalid from date');
    }
    if (!(toDate instanceof Date) || Number.isNaN(toDate.getTime())) {
      throw new Error('Invalid to date');
    }

    const targetUserId = requestedUserId || req.authUser.id;
    if (!isSuperuser(req.authUser) && targetUserId !== req.authUser.id) {
      if (!isAdmin(req.authUser)) {
        throw new Error('Forbidden');
      }
      const staffIds = await getAssignedStaffIds(req.authUser.id);
      if (!staffIds.includes(targetUserId)) {
        throw new Error('Forbidden');
      }
    }

    const records = await prisma.timeEntry.findMany({
      where: {
        userId: targetUserId,
        startAt: { lt: toDate },
        endAt: { gt: fromDate },
      },
      orderBy: { startAt: 'asc' },
    });

    return res.json(serializeMany('timeEntry', records));
  } catch (error) {
    if (error.message === 'Forbidden') return sendError(res, 403, 'Forbidden');
    return sendError(res, error.statusCode || 400, error.message || 'Calendar query failed');
  }
});

app.get('/api/:resource', requireAuth, async (req, res) => {
  try {
    const { resource } = req.params;
    const cfg = resourceConfig(resource);
    if (!cfg) return sendError(res, 404, 'Unknown resource');

    const scope = await scopeWhere(resource, req.authUser);
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
    const scope = await scopeWhere(req.params.resource, req.authUser);
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

Sentry.setupExpressErrorHandler(app);

app.listen(env.port, '0.0.0.0', async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }

  console.log(`Backend running at http://localhost:${env.port}`);
  console.log(`Frontend should run at ${env.frontendUrl}`);
});
