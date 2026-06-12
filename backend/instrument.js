import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Sentry from '@sentry/node'

function resolveSentryRelease() {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE
  try {
    const versionPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'app-version.json')
    const { full, version } = JSON.parse(fs.readFileSync(versionPath, 'utf8'))
    return full || version
  } catch {
    return undefined
  }
}

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  release: resolveSentryRelease(),
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
})
