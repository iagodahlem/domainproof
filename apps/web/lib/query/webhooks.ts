'use client'

import { useAuth } from '@clerk/nextjs'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
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

/** Wraps `POST /dashboard/.../enable` and `.../disable`. */
export function useToggleWebhookEndpointDisabled(
  projectId: string,
  endpoint: WebhookEndpointSummary,
) {
  const { getToken } = useAuth()
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
  })
}

/** Wraps `DELETE /dashboard/projects/:id/webhooks/:endpointId`. */
export function useDeleteWebhookEndpoint(
  projectId: string,
  endpointId: string,
) {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      await dashboardApi.deleteWebhookEndpoint(token, projectId, endpointId)
    },
  })
}
