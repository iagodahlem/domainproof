/**
 * Canonical localStorage key for the persisted light/dark theme choice.
 * Shared by `ThemeToggle` (this package) and apps/web's `ThemeProvider` so a
 * choice made on either surface persists across both — they used to disagree
 * (`dp-theme` vs `dp_theme`), which silently dropped the user's choice when
 * navigating between the two.
 */
export const THEME_STORAGE_KEY = 'dp-theme'
