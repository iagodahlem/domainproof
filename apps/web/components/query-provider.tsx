'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * One `QueryClient` per browser session (not per render) — created lazily in
 * `useState` so server-rendering this layout never shares a client across
 * requests. Queries default to no retries: every query/mutation here
 * previously failed on the first error with no retry loop, and the library
 * default of 3 retries with exponential backoff would silently delay error
 * states that used to surface immediately (see `DeliveryLog`).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
