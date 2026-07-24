// No 'use client' here: this module is genuinely isomorphic now — the
// `*QueryOptions` factories below have no client-only dependencies and are
// called directly from server components (a route's `page.tsx`,
// `prefetchQuery`); only the hooks that wrap them need a client boundary,
// and they get one implicitly by only ever being imported from files that
// already declare `'use client'` themselves. Marking the whole file client
// would turn every export — including the plain factories — into an opaque
// client reference server code can't call directly.
import { useAuth } from '@clerk/nextjs'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import type {
  DomainDetail,
  DomainEvent,
  DomainListItem,
  DomainMode,
  DomainStatus,
} from '@/lib/api/dashboard'

/**
 * `auth().getToken` (server, already resolved to a function by the time a
 * page awaits `auth()`) and `useAuth().getToken` (client) share this exact
 * shape — every `*QueryOptions` factory below takes one so the same
 * options object can be `prefetchQuery`'d from a server component and
 * built again with the client's own `getToken` for `useSuspenseQuery`,
 * keyed identically so hydration lines the two up.
 */
type GetToken = () => Promise<string | null>

/** Broad invalidation root — `invalidateQueries` matches by prefix, so this also covers `domainsListKey`'s mode-filtered variants below. */
export function domainsKey(projectId: string) {
  return ['domains', projectId] as const
}

/** The domains table's own list, filtered by the page's active mode tab — a distinct query per mode so switching tabs doesn't show the other mode's rows while refetching. */
export function domainsListKey(projectId: string, mode: DomainMode) {
  return [...domainsKey(projectId), 'list', mode] as const
}

export function domainKey(projectId: string, domainId: string) {
  return ['domains', projectId, domainId] as const
}

export function domainEventsKey(projectId: string, domainId: string) {
  return ['domains', projectId, domainId, 'events'] as const
}

/** The overview page's health-check snapshot — every domain across both modes, up to the dashboard API's max page size. A distinct key from `domainsListKey` since it's unfiltered and not paginated the way the table's own list is. */
export function overviewDomainsKey(projectId: string) {
  return [...domainsKey(projectId), 'overview'] as const
}

/** No further status change is possible without the caller re-verifying — same terminal set as the hosted page's own bounded poll. */
const TERMINAL_DOMAIN_STATUSES = new Set<DomainStatus>(['verified', 'failed'])

/** Same escalating backoff ladder and attempt cap as the hosted verification page's `useBoundedPoll` (quick at first, settling at a steady 30s, ~20 minutes total) — can't import that route-private hook across routes, so the schedule is mirrored here instead. */
const POLL_INTERVALS_MS = [3_000, 5_000, 8_000, 13_000, 20_000, 30_000] as const
const MAX_POLL_ATTEMPTS = 40

/**
 * Shared gate for the domain detail page's polling queries — reads a
 * domain query's own state (status + attempt count) and returns the next
 * interval, or `false` once the domain is terminal or the attempt cap is
 * hit. `useDomainEvents` calls this against `useDomain`'s cached state too,
 * so the events timeline stops polling in lockstep with the domain itself.
 */
function boundedPollInterval(
  domainState: { data?: DomainDetail; dataUpdateCount: number } | undefined,
) {
  const status = domainState?.data?.status
  if (!domainState || !status || TERMINAL_DOMAIN_STATUSES.has(status)) {
    return false as const
  }
  if (domainState.dataUpdateCount > MAX_POLL_ATTEMPTS) return false as const
  const index = Math.min(
    domainState.dataUpdateCount,
    POLL_INTERVALS_MS.length - 1,
  )
  return POLL_INTERVALS_MS[index]
}

/** Wraps `GET /dashboard/projects/:id/domains/:domainId` — the domain detail page's primary query, prefetched server-side and shared with `useDomain` via the same `domainKey`. */
export function domainQueryOptions(
  projectId: string,
  domainId: string,
  getToken: GetToken,
) {
  return queryOptions({
    queryKey: domainKey(projectId, domainId),
    queryFn: async () => {
      const token = await getToken()
      const { domain } = await dashboardApi.getDomain(
        token,
        projectId,
        domainId,
      )
      return domain
    },
  })
}

/**
 * Hydrated from the server prefetch on first render (no loading flash),
 * then polls on the schedule above while the domain hasn't reached a
 * terminal status yet. `initialData` is for the one caller with no
 * server prefetch of its own to hydrate from — the onboarding
 * walkthrough's `ClaimedDomainWalkthrough`, seeded from a plain prop
 * (either the create-domain mutation's own response, or the overview
 * page's `initialClaimedDomain`) — without it, that component would call
 * `queryFn` on its very first render, including during SSR, where
 * `useAuth()`'s `getToken` isn't safely callable yet.
 */
export function useDomain(
  projectId: string,
  domainId: string,
  initialData?: DomainDetail,
) {
  const { getToken } = useAuth()
  return useSuspenseQuery({
    ...domainQueryOptions(projectId, domainId, getToken),
    initialData,
    refetchInterval: (query) => boundedPollInterval(query.state),
  })
}

export interface DomainEventsPage {
  events: DomainEvent[]
  nextCursor: string | null
}

/** Wraps `GET /dashboard/.../events` (first page) — the domain detail page's secondary query, prefetched alongside `domainQueryOptions`. */
export function domainEventsQueryOptions(
  projectId: string,
  domainId: string,
  getToken: GetToken,
) {
  return queryOptions({
    queryKey: domainEventsKey(projectId, domainId),
    queryFn: async () => {
      const token = await getToken()
      const { events, nextCursor } = await dashboardApi.listDomainEvents(
        token,
        projectId,
        domainId,
      )
      return { events, nextCursor }
    },
  })
}

/**
 * Hydrated from the server prefetch on first render, then polls on the
 * same bounded schedule as `useDomain`, gated on that same domain query's
 * cached state, so the events timeline doesn't go stale while the status
 * pill is still polling and stops the moment the domain poll does.
 */
export function useDomainEvents(projectId: string, domainId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useSuspenseQuery({
    ...domainEventsQueryOptions(projectId, domainId, getToken),
    refetchInterval: () =>
      boundedPollInterval(
        queryClient.getQueryState<DomainDetail>(domainKey(projectId, domainId)),
      ),
  })
}

export interface DomainsListPage {
  domains: DomainListItem[]
  nextCursor: string | null
}

/** Wraps `GET /dashboard/projects/:id/domains` (first page), filtered by mode — the domains table's primary query. */
export function domainsListQueryOptions(
  projectId: string,
  mode: DomainMode,
  getToken: GetToken,
) {
  return queryOptions({
    queryKey: domainsListKey(projectId, mode),
    queryFn: async () => {
      const token = await getToken()
      const { domains, nextCursor } = await dashboardApi.listDomains(
        token,
        projectId,
        { mode },
      )
      return { domains, nextCursor }
    },
  })
}

/**
 * Bounded poll of the domains list — the Overview's "Agents & CLI" tab's
 * own "watch it land" step, active only while that tab is showing. An
 * agent claiming a domain through the MCP server or CLI happens outside
 * this browser tab entirely, so nothing would otherwise tell this page to
 * refetch. Same interval ladder as `useDomain`/`useDomainEvents`, but
 * gated on `enabled` rather than a terminal status — a list has no single
 * terminal state to stop on, only "the tab watching it is still active."
 */
export function useWatchDomainsList(
  projectId: string,
  mode: DomainMode,
  enabled: boolean,
) {
  const { getToken } = useAuth()
  return useQuery({
    queryKey: [...domainsListKey(projectId, mode), 'watch'] as const,
    queryFn: async () => {
      const token = await getToken()
      const { domains } = await dashboardApi.listDomains(token, projectId, {
        mode,
      })
      return domains
    },
    enabled,
    refetchInterval: (query) => {
      if (!enabled || query.state.dataUpdateCount > MAX_POLL_ATTEMPTS) {
        return false as const
      }
      const index = Math.min(
        query.state.dataUpdateCount,
        POLL_INTERVALS_MS.length - 1,
      )
      return POLL_INTERVALS_MS[index]
    },
  })
}

/**
 * Hydrated from the server prefetch on first render. Unlike
 * `useDomain`/`useDomainEvents` this doesn't poll, but being a real query
 * (rather than local component state) means it has a cache entry
 * `useDeleteDomain`/`useCreateDomain` can actually invalidate — the list
 * used to be seeded once into `useState` and never reconciled with
 * invalidations, so deleting a domain left it in the table until a full
 * reload remounted the page with fresh props.
 */
export function useDomainsList(projectId: string, mode: DomainMode) {
  const { getToken } = useAuth()
  return useSuspenseQuery(domainsListQueryOptions(projectId, mode, getToken))
}

// A snapshot for the overview page's health-check summary, not exhaustive
// pagination — the max page size the dashboard API allows in one call.
const OVERVIEW_DOMAINS_LIMIT = 100

export interface OverviewSnapshot {
  domains: DomainListItem[]
  truncated: boolean
  /** Whether this project has registered at least one webhook endpoint, in any mode — the checklist's third step. */
  anyWebhookRegistered: boolean
  /** The First-run walkthrough's sandbox domain, in full, if it's already been claimed — its source of truth so its state survives a remount. */
  initialClaimedDomain: DomainDetail | null
}

/**
 * The overview page's whole health-check snapshot — the domains list, the
 * any-webhook-registered flag, and the claimed sandbox domain (if any) —
 * as one query rather than three separate ones. All three used to be
 * independent `await`ed calls in the server component itself; bundling
 * them into a single `queryFn` keeps that same one-round-trip shape while
 * letting the *query* (not the route) do the awaiting, so the route can
 * `prefetchQuery` this without blocking and the client suspends on one
 * skeleton for the whole snapshot instead of three.
 */
export function overviewSnapshotQueryOptions(
  projectId: string,
  getToken: GetToken,
  sandboxDomain: string,
) {
  return queryOptions({
    queryKey: overviewDomainsKey(projectId),
    queryFn: async (): Promise<OverviewSnapshot> => {
      const token = await getToken()
      const [{ domains, nextCursor }, { endpoints }] = await Promise.all([
        dashboardApi.listDomains(token, projectId, {
          limit: OVERVIEW_DOMAINS_LIMIT,
        }),
        // No `mode` filter — the checklist only cares whether *any*
        // endpoint exists, in either mode.
        dashboardApi.listWebhookEndpoints(token, projectId),
      ])
      const sandboxSummary = domains.find(
        (domain) => domain.mode === 'test' && domain.domain === sandboxDomain,
      )
      const initialClaimedDomain = sandboxSummary
        ? (await dashboardApi.getDomain(token, projectId, sandboxSummary.id))
            .domain
        : null
      return {
        domains,
        truncated: nextCursor !== null,
        anyWebhookRegistered: endpoints.length > 0,
        initialClaimedDomain,
      }
    },
  })
}

/** Hydrated from the server prefetch on first render — see `overviewSnapshotQueryOptions`. */
export function useOverviewSnapshot(projectId: string, sandboxDomain: string) {
  const { getToken } = useAuth()
  return useSuspenseQuery(
    overviewSnapshotQueryOptions(projectId, getToken, sandboxDomain),
  )
}

/** Wraps `POST /dashboard/projects/:id/domains` — the add-domain panel's submit handler. */
export function useCreateDomain(projectId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { domain: string; mode: DomainMode }) => {
      const token = await getToken()
      return dashboardApi.createDomain(token, projectId, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainsKey(projectId) })
    },
  })
}

/**
 * Wraps `GET /dashboard/projects/:id/domains` — the domains table's "Load
 * more" cursor pagination. `mode` is the mode the page's initial list was
 * loaded for, threaded through so a later page doesn't drift onto the other
 * mode's rows — same reasoning as `EventsView`'s own `loadMore`.
 */
export function useListDomains(projectId: string, mode: DomainMode) {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async (cursor: string) => {
      const token = await getToken()
      return dashboardApi.listDomains(token, projectId, { cursor, mode })
    },
  })
}

/** Wraps `DELETE /dashboard/projects/:id/domains/:domainId`. */
export function useDeleteDomain(projectId: string, domainId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      await dashboardApi.deleteDomain(token, projectId, domainId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainsKey(projectId) })
      queryClient.invalidateQueries({
        queryKey: domainKey(projectId, domainId),
      })
    },
  })
}

/**
 * Wraps `POST /dashboard/.../verify` followed by a refetch of the events
 * timeline's first page — the timeline always has fresh events right after
 * a verify, which the initial server-rendered page never saw.
 */
export function useVerifyDomain(projectId: string, domainId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const { domain, check } = await dashboardApi.verifyDomain(
        token,
        projectId,
        domainId,
      )
      const { events, nextCursor } = await dashboardApi.listDomainEvents(
        token,
        projectId,
        domainId,
      )
      return { domain, check, events, nextCursor }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: domainKey(projectId, domainId),
      })
      queryClient.invalidateQueries({ queryKey: domainsKey(projectId) })
    },
  })
}

/**
 * Wraps `POST /dashboard/.../regenerate` followed by a refetch of the
 * events timeline's first page, same reasoning as `useVerifyDomain`.
 */
export function useRegenerateDomain(projectId: string, domainId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const { domain } = await dashboardApi.regenerateDomain(
        token,
        projectId,
        domainId,
      )
      const { events, nextCursor } = await dashboardApi.listDomainEvents(
        token,
        projectId,
        domainId,
      )
      return { domain, events, nextCursor }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: domainKey(projectId, domainId),
      })
      queryClient.invalidateQueries({ queryKey: domainsKey(projectId) })
    },
  })
}

/** Wraps `GET /dashboard/.../events` — the timeline's "Load more" cursor pagination. */
export function useListDomainEvents(projectId: string, domainId: string) {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async (cursor: string) => {
      const token = await getToken()
      return dashboardApi.listDomainEvents(token, projectId, domainId, {
        cursor,
      })
    },
  })
}
