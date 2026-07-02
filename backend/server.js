import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isAzureAppService = Boolean(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME);

function logStartupError(label, error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[startup] ${label}:`, message);
}

function ensurePrismaClientOnAzure() {
  if (!isAzureAppService) {
    return;
  }

  const prismaCli = path.join(rootDir, 'node_modules', 'prisma', 'build', 'index.js');
  if (!existsSync(prismaCli)) {
    throw new Error(`Prisma CLI not found at ${prismaCli}`);
  }

  console.log('[startup] Regenerating Prisma client for Azure...');
  const result = spawnSync(process.execPath, [prismaCli, 'generate'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`prisma generate failed with exit code ${result.status ?? 'unknown'}`);
  }

  console.log('[startup] Prisma client ready.');
}

process.on('uncaughtException', (error) => {
  logStartupError('uncaughtException', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logStartupError('unhandledRejection', reason);
  process.exit(1);
});

try {
  ensurePrismaClientOnAzure();
  await import('./instrument.js');
  await import('./src/index.js');
} catch (error) {
  logStartupError('failed to start Khonofy backend', error);
  process.exit(1);
}

console.log('[startup] Khonofy backend booted', {
  node: process.version,
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT || 3001,
  azure: Boolean(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME),
  databaseConfigured: Boolean(process.env.DATABASE_URL),
});
