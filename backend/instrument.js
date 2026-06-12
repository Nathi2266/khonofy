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

function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers
  const sensitive = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'api-key',
    'x-api-key',
    'x-auth-token',
  ])

  const next = { ...headers }
  for (const key of Object.keys(next)) {
    if (sensitive.has(String(key).toLowerCase())) {
      next[key] = '[Filtered]'
    }
  }
  return next
}

function scrubBreadcrumbs(breadcrumbs) {
  if (!Array.isArray(breadcrumbs)) return breadcrumbs
  return breadcrumbs.map((crumb) => {
    if (!crumb || typeof crumb !== 'object') return crumb
    const data = crumb.data && typeof crumb.data === 'object' ? { ...crumb.data } : undefined
    if (data?.headers) data.headers = scrubHeaders(data.headers)
    if (data?.request_headers) data.request_headers = scrubHeaders(data.request_headers)
    if (data?.response_headers) data.response_headers = scrubHeaders(data.response_headers)
    return data ? { ...crumb, data } : crumb
  })
}

const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
const isProduction = environment === 'production'
const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release: resolveSentryRelease(),
    sendDefaultPii: true,
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    includeLocalVariables: !isProduction,
    enableLogs: true,
    beforeSend(event) {
      if (!event || typeof event !== 'object') return event
      if (event.request?.headers) {
        event.request.headers = scrubHeaders(event.request.headers)
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = scrubBreadcrumbs(event.breadcrumbs)
      }
      return event
    },
  })
}
