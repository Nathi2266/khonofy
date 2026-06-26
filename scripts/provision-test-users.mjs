#!/usr/bin/env node
/**
 * Provisions a fresh staff + admin + superuser trio for one Khonofy test run.
 * Uses a bootstrap superuser to create users via the API.
 *
 * All test users share password: Demo123!
 * Staff is created with admin_id pointing at the new admin user.
 *
 * Usage:
 *   node scripts/provision-test-users.mjs
 *   KHONOFY_API_URL=https://... KHONOFY_BOOTSTRAP_SUPERUSER_EMAIL=... node scripts/provision-test-users.mjs
 *
 * Writes JSON to stdout and .cursor/test-run-credentials.json (override with KHONOFY_TEST_CREDENTIALS_OUT).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TEST_PASSWORD = 'Demo123!';

function normalizeApiBase(value) {
  return String(value || 'http://localhost:3001').replace(/\/$/, '');
}

function buildRunId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${suffix}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : String(data);
    throw new Error(`${options.method || 'GET'} ${url} failed (${response.status}): ${message}`);
  }

  return data;
}

async function login(apiBase, email, password) {
  const result = await requestJson(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return {
    token: result.access_token,
    user: result.user,
  };
}

async function createUser(apiBase, token, payload) {
  return requestJson(`${apiBase}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

async function main() {
  const runId = process.env.KHONOFY_TEST_RUN_ID || buildRunId();
  const apiBase = normalizeApiBase(process.env.KHONOFY_API_URL || process.env.VITE_API_URL);
  const bootstrapEmail = (
    process.env.KHONOFY_BOOTSTRAP_SUPERUSER_EMAIL || 'ali.khan@khonology.com'
  ).trim().toLowerCase();
  const bootstrapPassword = process.env.KHONOFY_BOOTSTRAP_SUPERUSER_PASSWORD || TEST_PASSWORD;

  const emails = {
    superuser: `test.superuser.${runId}@khonology.com`.toLowerCase(),
    admin: `test.admin.${runId}@khonology.com`.toLowerCase(),
    staff: `test.staff.${runId}@khonology.com`.toLowerCase(),
  };

  const { token } = await login(apiBase, bootstrapEmail, bootstrapPassword);

  const admin = await createUser(apiBase, token, {
    email: emails.admin,
    fullName: `Test Admin ${runId}`,
    password: TEST_PASSWORD,
    role: 'admin',
  });

  const staff = await createUser(apiBase, token, {
    email: emails.staff,
    fullName: `Test Staff ${runId}`,
    password: TEST_PASSWORD,
    role: 'staff',
    admin_id: admin.id,
  });

  const superuser = await createUser(apiBase, token, {
    email: emails.superuser,
    fullName: `Test Superuser ${runId}`,
    password: TEST_PASSWORD,
    role: 'superuser',
  });

  const result = {
    runId,
    apiBase,
    password: TEST_PASSWORD,
    provisionedAt: new Date().toISOString(),
    bootstrapSuperuser: bootstrapEmail,
    superuser: {
      email: emails.superuser,
      id: superuser.id,
      fullName: superuser.full_name || superuser.fullName,
      role: 'superuser',
    },
    admin: {
      email: emails.admin,
      id: admin.id,
      fullName: admin.full_name || admin.fullName,
      role: 'admin',
    },
    staff: {
      email: emails.staff,
      id: staff.id,
      fullName: staff.full_name || staff.fullName,
      role: 'staff',
      adminId: admin.id,
      adminEmail: emails.admin,
    },
  };

  const outPath = process.env.KHONOFY_TEST_CREDENTIALS_OUT
    || path.join('.cursor', 'test-run-credentials.json');

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
