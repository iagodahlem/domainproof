'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import type {
  DomainDetail,
  DomainMode,
  DomainStatus,
} from '@/lib/api/dashboard'

export function domainsKey(projectId: string) {
  return ['domains', projectId] as const
}

export function domainKey(projectId: string, domainId: string) {
  return ['domains', projectId, domainId] as const
}

/** No further status change is possible without the caller re-verifying — same terminal set as the hosted page's own bounded poll. */
const TERMINAL_DOMAIN_STATUSES = new Set<DomainStatus>(['verified', 'failed'])

/** Same escalating backoff ladder and attempt cap as the hosted verification page's `useBoundedPoll` (quick at first, settling at a steady 30s, ~20 minutes total) — can't import that route-private hook across routes, so the schedule is mirrored here instead. */
const POLL_INTERVALS_MS = [3_000, 5_000, 8_000, 13_000, 20_000, 30_000] as const
const MAX_POLL_ATTEMPTS = 40

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
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || TERMINAL_DOMAIN_STATUSES.has(status)) return false
      if (query.state.dataUpdateCount > MAX_POLL_ATTEMPTS) return false
      const index = Math.min(
        query.state.dataUpdateCount,
        POLL_INTERVALS_MS.length - 1,
      )
      return POLL_INTERVALS_MS[index]
    },
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
