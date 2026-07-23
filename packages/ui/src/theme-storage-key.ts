/**
 * Canonical localStorage key for the persisted light/dark theme choice.
 * Shared by `ThemeToggle` and `ThemeProvider` (both this package) and
 * apps/web's pre-paint script, so a choice made on any surface persists
 * across all of them — they used to disagree (`dp-theme` vs `dp_theme`),
 * which silently dropped the user's choice when navigating between them.
 */
export const THEME_STORAGE_KEY = 'dp-theme'
