const SETTINGS_KEY = 'pgi.settings.v1';

export function getSettings<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setSettings<T>(value: T): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // localStorage indisponível (modo privado, quota excedida, etc.) — falha silenciosa no protótipo.
  }
}
