import {
  defaultShouldDehydrateQuery,
  dehydrate,
  QueryClient,
} from '@tanstack/react-query'
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

/**
 * The canonical prefetch/dehydrate pattern for every dashboard route: a
 * server component calls `queryClient.prefetchQuery(...)` WITHOUT
 * `await`ing it, then immediately renders `<HydrationBoundary state={
 * dehydrateStreaming(queryClient)}>` around the client tree that reads the
 * same query via `useSuspenseQuery`. Because the prefetch hasn't resolved
 * yet at that point, the query is still `pending` — `dehydrate`'s default
 * `shouldDehydrateQuery` drops pending queries, which would hand the
 * client an empty cache and force a redundant client-side fetch (a
 * cache-miss waterfall behind the skeleton `loading.tsx` already shows).
 * Including `pending` queries here instead lets React's own streaming SSR
 * carry the still-in-flight promise across the RSC boundary: the server
 * starts the request, the client suspends on the skeleton, and the real
 * data streams in once the promise settles — no server wait, no waterfall.
 *
 * Never `await fetchQuery(...)` in a server component for the same
 * reason — it blocks the server on the API and defeats this whole
 * pattern. `prefetchQuery` + `dehydrateStreaming` is the only combination
 * that gets a fast TTFB *and* skips the client-side refetch.
 */
export function dehydrateStreaming(queryClient: QueryClient) {
  return dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
  })
}
