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
