const DATE_ONLY_FIELDS = {
  task: new Set(['dueDate']),
  timeEntry: new Set(['date']),
  timesheet: new Set(['weekStart', 'weekEnd']),
};

const ISO_FIELDS = {
  user: new Set(['createdAt', 'updatedAt', 'resetTokenExpiresAt']),
  department: new Set(['createdAt', 'updatedAt']),
  task: new Set(['createdAt', 'updatedAt']),
  timeEntry: new Set(['createdAt', 'updatedAt']),
  timesheet: new Set(['createdAt', 'updatedAt', 'submittedAt']),
  tag: new Set(['createdAt', 'updatedAt']),
  taskTemplate: new Set(['createdAt', 'updatedAt']),
  activityLog: new Set(['createdAt']),
};

export function toSnakeCase(value) {
  return value.replace(/([A-Z])/g, '_$1').toLowerCase();
}

export function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function serializeValue(modelName, key, value) {
  if (value instanceof Date) {
    if (DATE_ONLY_FIELDS[modelName]?.has(key)) {
      return formatDateOnly(value);
    }

    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeDeep(modelName, item));
  }

  if (value && typeof value === 'object') {
    return serializeDeep(modelName, value);
  }

  return value;
}

function serializeDeep(modelName, object) {
  if (!object || typeof object !== 'object') {
    return object;
  }

  return Object.entries(object).reduce((acc, [key, value]) => {
    const snakeKey = toSnakeCase(key);
    acc[snakeKey] = serializeValue(modelName, key, value);
    return acc;
  }, {});
}

export function serializeRecord(modelName, record) {
  if (!record) return null;

  const serialized = {};

  for (const [key, value] of Object.entries(record)) {
    const snakeKey =
      key === 'createdAt' ? 'created_date' :
      key === 'updatedAt' ? 'updated_date' :
      toSnakeCase(key);
    if (value instanceof Date) {
      const fields = DATE_ONLY_FIELDS[modelName];
      const isoFields = ISO_FIELDS[modelName];

      if (fields?.has(key)) {
        serialized[snakeKey] = formatDateOnly(value);
      } else if (isoFields?.has(key)) {
        serialized[snakeKey] = value.toISOString();
      } else {
        serialized[snakeKey] = value.toISOString();
      }
      continue;
    }

    if (Array.isArray(value)) {
      serialized[snakeKey] = value.map((item) => serializeValue(modelName, key, item));
      continue;
    }

    if (value && typeof value === 'object') {
      serialized[snakeKey] = serializeDeep(modelName, value);
      continue;
    }

    serialized[snakeKey] = value;
  }

  return serialized;
}

export function serializeMany(modelName, records) {
  return records.map((record) => serializeRecord(modelName, record));
}

export function normalizeInput(input) {
  if (Array.isArray(input)) {
    return input.map(normalizeInput);
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  return Object.entries(input).reduce((acc, [key, value]) => {
    const camelKey = toCamelCase(key);
    acc[camelKey] = normalizeInput(value);
    return acc;
  }, {});
}

export function parseDateOnly(value) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseDateTime(value) {
  if (!value) return undefined;
  return new Date(value);
}
