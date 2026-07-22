import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
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
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
