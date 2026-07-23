'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import type {
  DomainDetail,
  DomainEvent,
  DomainListItem,
  DomainMode,
  DomainStatus,
} from '@/lib/api/dashboard'

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

/**
 * Wraps `GET /dashboard/projects/:id/domains/:domainId` — seeded with the
 * server-rendered detail so there's no loading flash, then polls on the
 * schedule above while the domain hasn't reached a terminal status yet.
 */
export function useDomain(
  projectId: string,
  domainId: string,
  initialData: DomainDetail,
) {
  const { getToken } = useAuth()
  return useQuery({
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
    initialData,
    refetchInterval: (query) => boundedPollInterval(query.state),
  })
}

export interface DomainEventsPage {
  events: DomainEvent[]
  nextCursor: string | null
}

/**
 * Wraps `GET /dashboard/.../events` (first page) — seeded with the
 * server-rendered timeline, then polls on the same bounded schedule as
 * `useDomain`, gated on that same domain query's cached state, so the
 * events timeline doesn't go stale while the status pill is still polling
 * and stops the moment the domain poll does.
 */
export function useDomainEvents(
  projectId: string,
  domainId: string,
  initialData: DomainEventsPage,
) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useQuery({
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
    initialData,
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

/**
 * Wraps `GET /dashboard/projects/:id/domains` (first page) — seeded with
 * the server-rendered list so there's no loading flash. Unlike
 * `useDomain`/`useDomainEvents` this doesn't poll, but being a real query
 * (rather than local component state) means it has a cache entry
 * `useDeleteDomain`/`useCreateDomain` can actually invalidate — the list
 * used to be seeded once into `useState` and never reconciled with
 * invalidations, so deleting a domain left it in the table until a full
 * reload remounted the page with fresh props.
 */
export function useDomainsList(
  projectId: string,
  mode: DomainMode,
  initialData: DomainsListPage,
) {
  const { getToken } = useAuth()
  return useQuery({
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
    initialData,
  })
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
