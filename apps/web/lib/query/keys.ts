// No 'use client' here — see domains.ts's own note; `apiKeysQueryOptions`
// is called directly from a server component's `prefetchQuery`.
import { useAuth } from '@clerk/nextjs'
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import type { ApiKeyListItem } from '@/lib/api/dashboard'

/** See `domains.ts`'s own `GetToken` — same shape, shared by every `*QueryOptions` factory in this file. */
type GetToken = () => Promise<string | null>

export function apiKeysKey(projectId: string) {
  return ['api-keys', projectId] as const
}

/** Wraps `GET /dashboard/projects/:id/keys` — the settings page's API keys card. */
export function apiKeysQueryOptions(projectId: string, getToken: GetToken) {
  return queryOptions({
    queryKey: apiKeysKey(projectId),
    queryFn: async () => {
      const token = await getToken()
      const { apiKeys } = await dashboardApi.listKeys(token, projectId)
      return apiKeys
    },
  })
}

/** Hydrated from the server prefetch on first render — see `apiKeysQueryOptions`. */
export function useApiKeys(projectId: string) {
  const { getToken } = useAuth()
  return useSuspenseQuery(apiKeysQueryOptions(projectId, getToken))
}

export interface RotateOrRevokeKeyInput {
  keyId: string
  kind: 'rotate' | 'revoke'
}

/**
 * Wraps `POST /dashboard/projects/:id/keys/:keyId/rotate` and
 * `.../revoke` — both re-fetch the key list afterward and write it
 * straight into the query cache, so the settings card's table reflects
 * the server's own state without a separate local copy to reconcile.
 */
export function useRotateOrRevokeApiKey(projectId: string) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ keyId, kind }: RotateOrRevokeKeyInput) => {
      const token = await getToken()
      if (kind === 'rotate') {
        const result = await dashboardApi.rotateKey(token, projectId, keyId)
        const { apiKeys } = await dashboardApi.listKeys(token, projectId)
        return { kind, result, apiKeys }
      }
      await dashboardApi.revokeKey(token, projectId, keyId)
      const { apiKeys } = await dashboardApi.listKeys(token, projectId)
      return { kind, apiKeys }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ApiKeyListItem[]>(
        apiKeysKey(projectId),
        data.apiKeys,
      )
    },
  })
}
