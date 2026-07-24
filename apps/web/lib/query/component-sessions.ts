'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'

/** Wraps `POST /dashboard/projects/:id/component-sessions` — mints a fresh, single-use session token on demand (each is spent the moment a claim attempt runs, see the backend service's own doc comment), never cached against a query key. */
export function useCreateComponentSession(projectId: string) {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      return dashboardApi.createComponentSession(token, projectId)
    },
  })
}
