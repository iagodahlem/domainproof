import { QueryClient } from '@tanstack/react-query'
import { cache } from 'react'

/**
 * One `QueryClient` per server request — `cache()` dedupes it across every
 * call within the same render, so a route's `page.tsx` and any server
 * component it renders share the same instance to `prefetchQuery` into and
 * `dehydrate` from. Server-only: a client component gets its own
 * long-lived `QueryClient` from `QueryProvider` instead, and must never
 * import this (a `cache()`-memoized client shared across requests on the
 * client would leak data between users/sessions the way it can't on the
 * server, where `cache()` is scoped to one request).
 */
export const getQueryClient = cache(
  () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
)
