import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@domainproof/ui'
import { NO_FOUC_THEME_SCRIPT, ThemeFaviconSync } from '@/lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'DomainProof',
  description: 'Prove ownership of a domain.',
  icons: {
    // icon.svg carries its own prefers-color-scheme rule and is what
    // every SVG-favicon-capable browser actually uses; the PNG pairs
    // below are the fallback for browsers that only support <link
    // rel="icon" type="image/png">, split light/dark via `media` the same
    // way. /favicon.ico (apps/web/app/favicon.ico) is the last-resort
    // fallback browsers request unconditionally and needs no entry here.
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      {
        url: '/icon-dark-32.png',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon-light-32.png',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-16.png',
        sizes: '16x16',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon-light-16.png',
        sizes: '16x16',
        type: 'image/png',
        media: '(prefers-color-scheme: light)',
      },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider signInUrl="/" signUpUrl="/">
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Reads the stored/device theme and stamps `data-theme` before
              first paint — must stay a plain inline script, not next/script,
              so it runs synchronously ahead of CSS instead of being
              deferred. suppressHydrationWarning above covers the attribute
              it sets, which the server can't know in advance. */}
          <script dangerouslySetInnerHTML={{ __html: NO_FOUC_THEME_SCRIPT }} />
        </head>
        <body className="antialiased">
          {/* Global for the whole session — every surface (marketing,
              docs, dashboard, hosted) shares one theme and one favicon
              side effect instead of each route mounting its own. */}
          <ThemeProvider>
            <ThemeFaviconSync />
            {children}
          </ThemeProvider>
          {/* Clerk's Smart CAPTCHA widget mount — must exist in the DOM
              before authenticateWithRedirect() runs from any page that can
              start a sign-up, or bot-protected sign-ups fall back to an
              invisible check that can reject real users. Zero-height;
              global here so every page has it without a per-page mount. */}
          <div id="clerk-captcha" />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
