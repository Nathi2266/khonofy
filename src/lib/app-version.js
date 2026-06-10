import appVersionFile from '../../public/app-version.json';

/**
 * App version from VITE_APP_VERSION (CI build) or public/app-version.json (repo).
 */
export function getAppVersionLabel() {
  const raw = import.meta.env.VITE_APP_VERSION;
  if (raw) {
    return String(raw).replace(/^khonofy@/, '');
  }

  if (appVersionFile?.version && appVersionFile.version !== '0.0.0') {
    return appVersionFile.version;
  }

  return import.meta.env.DEV ? 'dev' : null;
}
