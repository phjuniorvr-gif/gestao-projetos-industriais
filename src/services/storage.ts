export function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage indisponível (modo privado, quota excedida, etc.) — falha silenciosa no protótipo.
  }
}

export const STORAGE_KEYS = {
  projects: 'pgi.projects.v1',
  catalog: 'pgi.catalog.v1',
  settings: 'pgi.settings.v1',
} as const;
