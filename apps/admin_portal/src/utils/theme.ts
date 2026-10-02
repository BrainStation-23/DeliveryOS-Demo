export const THEME_STORAGE_KEY = 'deliveryos_admin_theme';

export type Theme = 'light' | 'dark';

export function parseStoredTheme(raw: string | null): Theme {
  return raw === 'dark' ? 'dark' : 'light';
}

function readStoredTheme(): Theme {
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'light';
  }
}

function applyDarkClass(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function toggleTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

/** Restore the persisted theme before first paint; unknown values fall back to light. */
export function initTheme(): void {
  applyDarkClass(readStoredTheme());
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable — theme still applies for this session
  }
  applyDarkClass(theme);
}

export function currentTheme(): Theme {
  return readStoredTheme();
}
