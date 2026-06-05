import * as pdfjs from 'pdfjs-dist';
import {
  getImportFileKind,
  isSupportedImportFile,
  IMPORT_FILE_LABEL,
  readFileAsDataUrl,
} from '@/lib/import-file-types';

export { IMPORT_FILE_ACCEPT, IMPORT_FILE_LABEL, getImportFileKind, isSupportedImportFile } from '@/lib/import-file-types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.\w+/;

const HEADER_ALIASES = {
  name: ['name', 'full name', 'fullname', 'full_name', 'user', 'user name'],
  email: ['email', 'email address', 'e-mail'],
  department: ['department', 'dept', 'department name'],
  designation: ['designation', 'title', 'job title', 'position', 'role title'],
};

const REQUIRED_FIELD_LABELS = {
  name: 'Full Name',
  email: 'Email',
  department: 'Department',
  designation: 'Designation',
};

const REQUIRED_FIELDS_ERROR =
  'The document must include Full Name, Email, Department, and Designation for each user.';

/**
 * @typedef {Object} ParsedImportUser
 * @property {string} fullName
 * @property {string} email
 * @property {string} department
 * @property {string} designation
 */

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function findHeaderIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function rowFromValues(values, mapping) {
  const getValue = (index, fallbackIndex) => {
    if (index >= 0 && values[index]) return values[index].trim();
    if (fallbackIndex >= 0 && values[fallbackIndex]) return values[fallbackIndex].trim();
    return '';
  };

  return {
    fullName: getValue(mapping.name, 0),
    email: getValue(mapping.email, 1),
    department: getValue(mapping.department, 2),
    designation: getValue(mapping.designation, 3),
  };
}

function buildHeaderMapping(headers) {
  return {
    name: findHeaderIndex(headers, HEADER_ALIASES.name),
    email: findHeaderIndex(headers, HEADER_ALIASES.email),
    department: findHeaderIndex(headers, HEADER_ALIASES.department),
    designation: findHeaderIndex(headers, HEADER_ALIASES.designation),
  };
}

function missingRequiredFieldLabels(mapping) {
  return Object.entries(REQUIRED_FIELD_LABELS)
    .filter(([key]) => mapping[key] < 0)
    .map(([, label]) => label);
}

function validateHeaderMapping(mapping, formatLabel) {
  const missing = missingRequiredFieldLabels(mapping);
  if (missing.length) {
    throw new Error(
      `The ${formatLabel} is missing required columns: ${missing.join(', ')}. ${REQUIRED_FIELDS_ERROR}`,
    );
  }
}

function rowHasAllRequiredFields(row) {
  return Boolean(
    row.fullName?.trim()
    && row.email?.trim()
    && row.department?.trim()
    && row.designation?.trim(),
  );
}

function looksLikeHeader(values) {
  const headers = values.map(normalizeHeader);
  const mapping = buildHeaderMapping(headers);
  return missingRequiredFieldLabels(mapping).length === 0;
}

function validatePdfFieldLabels(text) {
  const normalized = text.toLowerCase();
  const missing = Object.entries(HEADER_ALIASES)
    .filter(([, aliases]) => !aliases.some((alias) => normalized.includes(alias)))
    .map(([key]) => REQUIRED_FIELD_LABELS[key]);

  if (missing.length) {
    throw new Error(
      `The PDF is missing required field labels: ${missing.join(', ')}. ${REQUIRED_FIELDS_ERROR}`,
    );
  }
}

/**
 * @param {ParsedImportUser[]} rows
 */
export function validateImportDocument(rows) {
  if (!rows?.length) {
    throw new Error('No users were found in this document.');
  }

  if (!rows.some(rowHasAllRequiredFields)) {
    throw new Error(
      `The document does not contain complete user records. ${REQUIRED_FIELDS_ERROR}`,
    );
  }
}

/**
 * @param {string} text
 * @returns {ParsedImportUser[]}
 */
export function parseCsvUsers(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const firstValues = parseCsvLine(lines[0]);
  const hasHeader = looksLikeHeader(firstValues);
  if (!hasHeader) {
    throw new Error(
      `The CSV must include a header row with columns: ${Object.values(REQUIRED_FIELD_LABELS).join(', ')}.`,
    );
  }

  const headers = firstValues.map(normalizeHeader);
  const mapping = buildHeaderMapping(headers);
  validateHeaderMapping(mapping, 'CSV file');

  return lines
    .slice(1)
    .map((line) => rowFromValues(parseCsvLine(line), mapping))
    .filter((row) => row.fullName || row.email || row.department || row.designation);
}

/**
 * @param {string} line
 * @returns {ParsedImportUser | null}
 */
function parseLooseLine(line) {
  const emailMatch = line.match(EMAIL_PATTERN);
  if (!emailMatch) return null;

  const email = emailMatch[0];
  const commaParts = line.split(',').map((part) => part.trim()).filter(Boolean);

  if (commaParts.length >= 3) {
    const emailIndex = commaParts.findIndex((part) => part.includes(email));
    const name = emailIndex > 0 ? commaParts[0] : commaParts.find((part) => !part.includes('@')) || '';
    const department = commaParts[emailIndex + 1] || commaParts[2] || '';
    const designation = commaParts[emailIndex + 2] || commaParts[3] || '';
    return {
      fullName: name.replace(email, '').trim() || name,
      email,
      department,
      designation,
    };
  }

  const withoutEmail = line.replace(email, ' ').replace(/\s+/g, ' ').trim();
  const splitParts = withoutEmail.split(/\s{2,}|\t| - /).map((part) => part.trim()).filter(Boolean);

  return {
    fullName: splitParts[0] || withoutEmail,
    email,
    department: splitParts[1] || '',
    designation: splitParts[2] || '',
  };
}

/**
 * @param {string} text
 * @returns {ParsedImportUser[]}
 */
export function parsePdfUsers(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    if (looksLikeHeader(line.split(/\s{2,}|,|\t/).map(normalizeHeader))) continue;
    const row = parseLooseLine(line);
    if (row) rows.push(row);
  }

  if (rows.length) return rows;

  const csvLike = lines.join('\n');
  return parseCsvUsers(csvLike);
}

/**
 * @param {File} file
 */
export async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n');
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
async function extractDocxText(file) {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
async function extractXlsxText(file) {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  if (!workbook.SheetNames.length) return '';

  return workbook.SheetNames
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet).trim();
      if (!csv) return '';
      return workbook.SheetNames.length > 1
        ? `Sheet: ${sheetName}\n${csv}`
        : csv;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractImportDocumentText(file) {
  const kind = getImportFileKind(file);
  if (!kind || kind === 'image') {
    throw new Error(`Unsupported file type. Upload a ${IMPORT_FILE_LABEL} file.`);
  }

  if (kind === 'csv' || kind === 'txt') {
    return file.text();
  }

  if (kind === 'pdf') {
    return extractPdfText(file);
  }

  if (kind === 'docx') {
    return extractDocxText(file);
  }

  if (kind === 'xlsx') {
    return extractXlsxText(file);
  }

  throw new Error(`Unsupported file type. Upload a ${IMPORT_FILE_LABEL} file.`);
}

/**
 * @param {File} file
 * @returns {Promise<{ fileName: string, text?: string, imageBase64?: string, imageMimeType?: string }>}
 */
export async function prepareImportScanPayload(file) {
  const kind = getImportFileKind(file);
  if (!kind) {
    throw new Error(`Unsupported file type. Upload a ${IMPORT_FILE_LABEL} file.`);
  }

  if (kind === 'image') {
    const dataUrl = await readFileAsDataUrl(file);
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Failed to read the uploaded image.');
    }

    return {
      fileName: file.name,
      imageMimeType: match[1],
      imageBase64: match[2],
    };
  }

  const text = await extractImportDocumentText(file);
  if (!text.trim()) {
    throw new Error('The uploaded document is empty.');
  }

  return {
    fileName: file.name,
    text,
  };
}

function uniqueTagNamesCaseInsensitive(names) {
  const byKey = new Map();
  for (const name of names) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  return [...byKey.values()];
}

function findTagByName(items, name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  return items.find((item) => item.name.trim().toLowerCase() === key) || null;
}

async function findOrCreateImportTag({
  name,
  byName,
  created,
  create,
  findExisting,
}) {
  const normalized = String(name || '').trim();
  const key = normalized.toLowerCase();
  if (!normalized || byName.has(key)) return;

  try {
    const createdItem = await create({ name: normalized });
    byName.set(key, createdItem);
    created.push(createdItem);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/already exists/i.test(message)) throw error;
  }

  const existing = await findExisting(normalized);
  if (!existing) {
    throw new Error(`${normalized} already exists`);
  }

  byName.set(key, existing);
}

/**
 * @param {ParsedImportUser[]} rows
 * @param {Array<{ id: string, name: string }>} departments
 * @param {Array<{ id: string, name: string }>} designations
 * @param {{
 *   createDepartment: (data: { name: string }) => Promise<{ id: string, name: string }>,
 *   createDesignation: (data: { name: string }) => Promise<{ id: string, name: string }>,
 *   findDepartmentByName?: (name: string) => Promise<{ id: string, name: string } | null>,
 *   findDesignationByName?: (name: string) => Promise<{ id: string, name: string } | null>,
 * }} creators
 */
export async function ensureImportTagsForRows(rows, departments, designations, {
  createDepartment,
  createDesignation,
  findDepartmentByName,
  findDesignationByName,
}) {
  const deptByName = new Map(
    departments.map((item) => [item.name.trim().toLowerCase(), item]),
  );
  const desigByName = new Map(
    designations.map((item) => [item.name.trim().toLowerCase(), item]),
  );
  const createdDepartments = [];
  const createdDesignations = [];

  const uniqueDepartmentNames = uniqueTagNamesCaseInsensitive(
    rows.map((row) => row.department),
  );
  const uniqueDesignationNames = uniqueTagNamesCaseInsensitive(
    rows.map((row) => row.designation),
  );

  const resolveDepartment = findDepartmentByName
    || ((name) => Promise.resolve(findTagByName(departments, name)));
  const resolveDesignation = findDesignationByName
    || ((name) => Promise.resolve(findTagByName(designations, name)));

  for (const name of uniqueDepartmentNames) {
    await findOrCreateImportTag({
      name,
      byName: deptByName,
      created: createdDepartments,
      create: createDepartment,
      findExisting: resolveDepartment,
    });
  }

  for (const name of uniqueDesignationNames) {
    await findOrCreateImportTag({
      name,
      byName: desigByName,
      created: createdDesignations,
      create: createDesignation,
      findExisting: resolveDesignation,
    });
  }

  return {
    departments: [...deptByName.values()],
    designations: [...desigByName.values()],
    createdDepartments,
    createdDesignations,
  };
}

/**
 * @param {ParsedImportUser[]} rows
 * @param {Array<{ id: string, name: string }>} departments
 * @param {Array<{ id: string, name: string }>} designations
 */
export function getPendingImportTags(rows, departments, designations) {
  const existingDepartments = new Set(
    departments.map((item) => item.name.trim().toLowerCase()),
  );
  const existingDesignations = new Set(
    designations.map((item) => item.name.trim().toLowerCase()),
  );

  const pendingDepartments = uniqueTagNamesCaseInsensitive(
    rows.map((row) => row.department),
  ).filter((name) => !existingDepartments.has(name.toLowerCase()));

  const pendingDesignations = uniqueTagNamesCaseInsensitive(
    rows.map((row) => row.designation),
  ).filter((name) => !existingDesignations.has(name.toLowerCase()));

  return { pendingDepartments, pendingDesignations };
}

/**
 * @param {{ pendingDepartments: string[], pendingDesignations: string[] }} pending
 */
export function formatPendingImportTagsSummary({ pendingDepartments, pendingDesignations }) {
  const parts = [];
  if (pendingDepartments.length) {
    parts.push(`${pendingDepartments.length} new department${pendingDepartments.length === 1 ? '' : 's'}`);
  }
  if (pendingDesignations.length) {
    parts.push(`${pendingDesignations.length} new designation${pendingDesignations.length === 1 ? '' : 's'}`);
  }
  if (!parts.length) return '';
  return `${parts.join(' and ')} will be created when you click Create Users.`;
}

/**
 * @param {File} file
 * @returns {Promise<ParsedImportUser[]>}
 */
export async function parseUserImportFile(file) {
  const kind = getImportFileKind(file);
  if (!kind || kind === 'image') {
    throw new Error(`Unsupported file type. Upload a ${IMPORT_FILE_LABEL} file.`);
  }

  const text = await extractImportDocumentText(file);

  if (kind === 'csv' || kind === 'xlsx') {
    const rows = parseCsvUsers(text);
    validateImportDocument(rows);
    return rows;
  }

  if (kind === 'pdf') {
    validatePdfFieldLabels(text);
    const rows = parsePdfUsers(text);
    validateImportDocument(rows);
    return rows;
  }

  if (kind === 'txt' || kind === 'docx') {
    const rows = parsePdfUsers(text);
    validateImportDocument(rows);
    return rows;
  }

  throw new Error(`Unsupported file type. Upload a ${IMPORT_FILE_LABEL} file.`);
}

function matchByName(items, value) {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  return items.find((item) => item.name.trim().toLowerCase() === normalized) || null;
}

/**
 * @param {ParsedImportUser[]} rows
 * @param {{
 *   departments: Array<{ id: string, name: string }>,
 *   designations: Array<{ id: string, name: string }>,
 *   allowPendingTags?: boolean,
 * }} context
 */
export function validateImportRows(rows, { departments, designations, allowPendingTags = false }) {
  return rows.map((row, index) => {
    const issues = [];

    if (!row.fullName.trim()) issues.push('Missing name');
    if (!row.email.trim()) issues.push('Missing email');
    else if (!EMAIL_PATTERN.test(row.email.trim())) issues.push('Invalid email format');

    if (!row.department.trim()) issues.push('Missing department');
    if (!row.designation.trim()) issues.push('Missing designation');

    const department = matchByName(departments, row.department);
    const designation = matchByName(designations, row.designation);
    const willCreateDepartment = Boolean(row.department.trim() && !department);
    const willCreateDesignation = Boolean(row.designation.trim() && !designation);

    if (willCreateDepartment && !allowPendingTags) {
      issues.push(`Unknown department: ${row.department}`);
    }
    if (willCreateDesignation && !allowPendingTags) {
      issues.push(`Unknown designation: ${row.designation}`);
    }

    return {
      ...row,
      rowNumber: index + 1,
      departmentId: department?.id || null,
      designationId: designation?.id || null,
      willCreateDepartment: allowPendingTags && willCreateDepartment,
      willCreateDesignation: allowPendingTags && willCreateDesignation,
      issues,
      valid: issues.length === 0,
    };
  });
}
