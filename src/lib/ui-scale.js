import uiScaleConfig from '../../config/ui-scale.json';

export const UI_SCALE_STORAGE_KEY = 'khonofy_ui_scale';
export const UI_SCALE_CHANGE_EVENT = 'khonofy:ui-scale-change';

export const DEFAULT_UI_SCALE = uiScaleConfig.defaultScale;
export const MIN_UI_SCALE = uiScaleConfig.minScale;
export const MAX_UI_SCALE = uiScaleConfig.maxScale;
export const UI_SCALE_STEP = uiScaleConfig.step;

function clampScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_UI_SCALE;
  return Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, numeric));
}

function supportsCssZoom() {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports('zoom', '0.7');
}

export function applyUiScale(scale) {
  if (typeof document === 'undefined') return DEFAULT_UI_SCALE;

  const clamped = clampScale(scale);
  const root = document.documentElement;

  root.style.setProperty('--ui-scale', String(clamped));
  root.style.zoom = '';

  if (supportsCssZoom()) {
    root.style.fontSize = '';
  } else {
    root.style.fontSize = `${clamped * 100}%`;
  }

  root.dataset.uiScale = String(clamped);
  return clamped;
}

export function getUiScale() {
  if (typeof window === 'undefined') return DEFAULT_UI_SCALE;

  const stored = window.localStorage.getItem(UI_SCALE_STORAGE_KEY);
  if (stored == null) return DEFAULT_UI_SCALE;

  return clampScale(stored);
}

export function setUiScale(scale) {
  const clamped = clampScale(scale);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent(UI_SCALE_CHANGE_EVENT, { detail: clamped }));
  }

  return applyUiScale(clamped);
}

export function resetUiScale() {
  return setUiScale(DEFAULT_UI_SCALE);
}

export function initUiScale() {
  return applyUiScale(getUiScale());
}

export function formatUiScalePercent(scale) {
  return `${Math.round(clampScale(scale) * 100)}%`;
}
