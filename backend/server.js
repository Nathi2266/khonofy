import process from 'node:process';

function logStartupError(label, error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[startup] ${label}:`, message);
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
