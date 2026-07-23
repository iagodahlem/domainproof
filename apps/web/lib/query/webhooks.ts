// No 'use client' here — see domains.ts's own note; `webhookEndpointsQueryOptions`
// is called directly from a server component's `prefetchQuery`.
import { useAuth } from '@clerk/nextjs'
import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type InfiniteData,
} from '@tanstack/react-query'
import { dashboardApi, WEBHOOK_EVENT_TYPES } from '@/lib/api/dashboard'
import type {
  ListDeliveriesResult,
  Mode,
  WebhookEndpointSummary,
  WebhookEventType,
} from '@/lib/api/dashboard'

// Re-exported so components can enumerate the event-type vocabulary
// without reaching past the query layer into lib/api directly.
export { WEBHOOK_EVENT_TYPES }

/** See `domains.ts`'s own `GetToken` — same shape, shared by every `*QueryOptions` factory in this file. */
type GetToken = () => Promise<string | null>

/** The endpoints table's own list, filtered by the page's active mode tab — a distinct query per mode, same reasoning as `domainsListKey`. */
export function webhookEndpointsKey(projectId: string, mode: Mode) {
  return ['webhook-endpoints', projectId, mode] as const
}

/** Wraps `GET /dashboard/projects/:id/webhooks`, filtered by mode — the webhooks page's primary query. */
export function webhookEndpointsQueryOptions(
  projectId: string,
  mode: Mode,
  getToken: GetToken,
) {
  return queryOptions({
    queryKey: webhookEndpointsKey(projectId, mode),
    queryFn: async () => {
      const token = await getToken()
      const { endpoints } = await dashboardApi.listWebhookEndpoints(
        token,
        projectId,
        { mode },
      )
      return endpoints
    },
  })
}

/** Hydrated from the server prefetch on first render — see `webhookEndpointsQueryOptions`. */
export function useWebhookEndpoints(projectId: string, mode: Mode) {
  const { getToken } = useAuth()
  return useSuspenseQuery(
    webhookEndpointsQueryOptions(projectId, mode, getToken),
  )
}

/** Wraps `POST /dashboard/projects/:id/webhooks` — the add-endpoint panel's submit handler. */
export function useCreateWebhookEndpoint(projectId: string) {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      url: string
      mode: Mode
      eventTypes: WebhookEventType[]
    }) => {
      const token = await getToken()
      return dashboardApi.createWebhookEndpoint(token, projectId, input)
    },
  })
}

export function webhookDeliveriesKey(projectId: string, endpointId: string) {
  return ['webhook-deliveries', projectId, endpointId] as const
}

/** Wraps `GET /dashboard/.../deliveries` — cursor-paginated via `fetchNextPage`. */
export function useWebhookDeliveries(projectId: string, endpointId: string) {
  const { getToken } = useAuth()
  return useInfiniteQuery({
    queryKey: webhookDeliveriesKey(projectId, endpointId),
    queryFn: async ({ pageParam }) => {
      const token = await getToken()
      return dashboardApi.listWebhookDeliveries(token, projectId, endpointId, {
        cursor: pageParam ?? undefined,
      })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

/**
 * Wraps `POST /dashboard/.../deliveries/:id/redeliver` — fires a fresh
 * delivery (attempt 1 of a new row, not a mutation of the original) and
 * prepends it to the deliveries query's first cached page.
 */
export function useRedeliverWebhookDelivery(
  projectId: string,
  endpointId: string,
) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = webhookDeliveriesKey(projectId, endpointId)

  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const token = await getToken()
      const { delivery } = await dashboardApi.redeliverWebhookDelivery(
        token,
        projectId,
        endpointId,
        deliveryId,
      )
      return delivery
    },
    onSuccess: (delivery) => {
      queryClient.setQueryData<
        InfiniteData<ListDeliveriesResult, string | null>
      >(queryKey, (old) => {
        const [firstPage, ...restPages] = old?.pages ?? []
        if (!old || !firstPage) return old
        return {
          ...old,
          pages: [
            { ...firstPage, deliveries: [delivery, ...firstPage.deliveries] },
            ...restPages,
          ],
        }
      })
    },
  })
}

/**
 * Wraps `POST /dashboard/.../enable` and `.../disable`, syncing the result
 * straight into the endpoints list query so the row reflects the flip
 * without a refetch — same reasoning as `useVerifyDomain`'s
 * `setQueryData` in `domains.ts`.
 */
export function useToggleWebhookEndpointDisabled(
  projectId: string,
  endpoint: WebhookEndpointSummary,
) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const { endpoint: updated } = endpoint.disabled
        ? await dashboardApi.enableWebhookEndpoint(
            token,
            projectId,
            endpoint.id,
          )
        : await dashboardApi.disableWebhookEndpoint(
            token,
            projectId,
            endpoint.id,
          )
      return updated
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        webhookEndpointsKey(projectId, updated.mode),
        (current: WebhookEndpointSummary[] | undefined) =>
          current?.map((item) => (item.id === updated.id ? updated : item)),
      )
    },
  })
}

/** Wraps `DELETE /dashboard/projects/:id/webhooks/:endpointId`, then removes the row from the endpoints list query. */
export function useDeleteWebhookEndpoint(
  projectId: string,
  endpoint: WebhookEndpointSummary,
) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      await dashboardApi.deleteWebhookEndpoint(token, projectId, endpoint.id)
    },
    onSuccess: () => {
      queryClient.setQueryData(
        webhookEndpointsKey(projectId, endpoint.mode),
        (current: WebhookEndpointSummary[] | undefined) =>
          current?.filter((item) => item.id !== endpoint.id),
      )
    },
  })
}
