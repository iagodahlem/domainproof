'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'

export interface RotateOrRevokeKeyInput {
  keyId: string
  kind: 'rotate' | 'revoke'
}

/**
 * Wraps `POST /dashboard/projects/:id/keys/:keyId/rotate` and
 * `.../revoke` — both re-fetch the key list afterward so the settings
 * card's table always reflects the server's own state.
 */
export function useRotateOrRevokeApiKey(projectId: string) {
  const { getToken } = useAuth()
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
  })
}
