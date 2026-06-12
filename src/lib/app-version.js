import appVersionFile from '../../public/app-version.json';

function normalizeVersionLabel(value) {
  if (!value) return null;
  const withoutPrefix = String(value).replace(/^khonofy@/, '');
  const semverOnly = withoutPrefix.split('+')[0].trim();
  return semverOnly || null;
}

/**
 * Display version (semver only), e.g. 1.0.21 — from CI env or public/app-version.json.
 */
export function getAppVersionLabel() {
  const raw = import.meta.env.VITE_APP_VERSION;
  if (raw) {
    return normalizeVersionLabel(raw);
  }

  if (appVersionFile?.version && appVersionFile.version !== '0.0.0') {
    return normalizeVersionLabel(appVersionFile.version);
  }

  return import.meta.env.DEV ? 'dev' : null;
}
