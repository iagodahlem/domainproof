// No 'use client' here — see domains.ts's own note; `projectEventsQueryOptions`
// is called directly from a server component's `prefetchQuery`.
import { useAuth } from '@clerk/nextjs'
import {
  queryOptions,
  useMutation,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import type { Mode, ProjectEventSummary } from '@/lib/api/dashboard'

/** See `domains.ts`'s own `GetToken` — same shape, shared by every `*QueryOptions` factory in this file. */
type GetToken = () => Promise<string | null>

/** The project-wide events table's own list, filtered by the page's active mode tab — a distinct query per mode, same reasoning as `domainsListKey`. */
export function projectEventsKey(projectId: string, mode: Mode) {
  return ['project-events', projectId, mode] as const
}

export interface ProjectEventsPage {
  events: ProjectEventSummary[]
  nextCursor: string | null
}

/** Wraps `GET /dashboard/projects/:id/events` (first page), filtered by mode — the events page's primary query. */
export function projectEventsQueryOptions(
  projectId: string,
  mode: Mode,
  getToken: GetToken,
) {
  return queryOptions({
    queryKey: projectEventsKey(projectId, mode),
    queryFn: async () => {
      const token = await getToken()
      const { events, nextCursor } = await dashboardApi.listProjectEvents(
        token,
        projectId,
        { mode },
      )
      return { events, nextCursor }
    },
  })
}

/** Hydrated from the server prefetch on first render — see `projectEventsQueryOptions`. */
export function useProjectEvents(projectId: string, mode: Mode) {
  const { getToken } = useAuth()
  return useSuspenseQuery(projectEventsQueryOptions(projectId, mode, getToken))
}

/** Wraps `GET /dashboard/.../events` — the events table's "Load more" cursor pagination, same shape as `useListDomains`/`useListDomainEvents` in `domains.ts`. */
export function useListProjectEvents(projectId: string, mode: Mode) {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async (cursor: string) => {
      const token = await getToken()
      return dashboardApi.listProjectEvents(token, projectId, { cursor, mode })
    },
  })
}
