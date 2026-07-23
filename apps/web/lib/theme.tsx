'use client'

import { useEffect } from 'react'
import {
  THEME_STORAGE_KEY,
  useTheme,
  type ThemeOverride,
} from '@domainproof/ui'

const PREFERS_LIGHT_QUERY = '(prefers-color-scheme: light)'

/**
 * Sets `data-theme` on `<html>` before React hydrates or CSS paints — the
 * standard no-FOUC pattern. Resolution order: explicit stored choice, then
 * the device's own `prefers-color-scheme`, then dark. Kept as a plain string
 * template (rather than a function this module calls) since it runs as a
 * standalone inline `<script>` in `RootLayout`'s `<head>`, before React or
 * this file loads — the canonical key still comes from the imported
 * constant via interpolation below, so it can't drift from
 * @domainproof/ui's value.
 */
export const NO_FOUC_THEME_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var t=(s==='dark'||s==='light')?s:(matchMedia('${PREFERS_LIGHT_QUERY}').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`

const FAVICON_HREFS: Record<
  ThemeOverride,
  { svg: string; png32: string; png16: string }
> = {
  dark: {
    svg: '/icon-dark.svg',
    png32: '/icon-dark-32.png',
    png16: '/icon-dark-16.png',
  },
  light: {
    svg: '/icon-light.svg',
    png32: '/icon-light-32.png',
    png16: '/icon-light-16.png',
  },
}

const OVERRIDE_ID_PREFIX = 'dp-theme-favicon-override'
const PRELOAD_ID_PREFIX = 'dp-theme-favicon-preload'

/**
 * Forces the icon links to a specific theme instead of the
 * prefers-color-scheme media queries baked into layout.tsx's metadata —
 * those track the OS setting, which no longer matches the page once the
 * in-app toggle overrides it. Appends its own unconditional `<link>` tags
 * (last in `<head>`, so browsers prefer them over the earlier
 * media-conditioned ones) rather than mutating React's own metadata
 * nodes in place — those get re-rendered on navigation/Fast Refresh, and
 * React has no way to know a node it owns was edited out from under it.
 */
function applyFavicon(theme: ThemeOverride) {
  const hrefs = FAVICON_HREFS[theme]
  upsertIconLink(`${OVERRIDE_ID_PREFIX}-svg`, 'image/svg+xml', hrefs.svg)
  upsertIconLink(`${OVERRIDE_ID_PREFIX}-32`, 'image/png', hrefs.png32, '32x32')
  upsertIconLink(`${OVERRIDE_ID_PREFIX}-16`, 'image/png', hrefs.png16, '16x16')
}

function upsertIconLink(
  id: string,
  type: string,
  href: string,
  sizes?: string,
) {
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'icon'
    link.type = type
    if (sizes) link.setAttribute('sizes', sizes)
    document.head.appendChild(link)
  }
  link.href = href
}

/**
 * Warms the browser's cache for every favicon asset of both themes, not
 * just the active one — otherwise the first toggle to the theme that
 * hasn't been rendered yet has to fetch its icon files from scratch,
 * and the tab icon doesn't visibly swap on that first click. Uses
 * `rel="prefetch"` (rather than `rel="preload"`, which Chrome warns about
 * when the fetched resource isn't consumed within a few seconds of load —
 * exactly this case, since the inactive theme's icons are fetched for
 * *later*, not immediate, use; and rather than an `Image()` object, which
 * isn't guaranteed to hit the same cache entry a `<link rel="icon">`
 * reuses) and id-guards each href so remounts (Fast Refresh, StrictMode)
 * don't append duplicate `<link>` nodes or refetch what's already cached.
 */
function preloadFavicons() {
  for (const [theme, hrefs] of Object.entries(FAVICON_HREFS)) {
    prefetchImage(`${PRELOAD_ID_PREFIX}-${theme}-svg`, hrefs.svg)
    prefetchImage(`${PRELOAD_ID_PREFIX}-${theme}-32`, hrefs.png32)
    prefetchImage(`${PRELOAD_ID_PREFIX}-${theme}-16`, hrefs.png16)
  }
}

function prefetchImage(id: string, href: string) {
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'prefetch'
  link.as = 'image'
  link.href = href
  document.head.appendChild(link)
}

/**
 * Keeps the tab favicon in sync with the global theme (`@domainproof/ui`'s
 * `ThemeProvider`) on every surface — mounted once in `RootLayout` alongside
 * that provider, rather than nested under any one route, so a toggle on
 * marketing/docs/dashboard/hosted all update the same favicon links instead
 * of only the route that happens to own this effect.
 */
export function ThemeFaviconSync() {
  const { theme } = useTheme()

  useEffect(() => {
    preloadFavicons()
    // Runs once: warming both themes' assets doesn't need to repeat on
    // every theme change, only on first mount.
  }, [])

  useEffect(() => {
    applyFavicon(theme)
  }, [theme])

  return null
}
