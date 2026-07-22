'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'

/** Wraps `POST /dashboard/projects` — the create-project screen's submit handler. */
export function useCreateProject() {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async (name: string) => {
      const token = await getToken()
      return dashboardApi.createProject(token, name)
    },
    onError: (error) => {
      console.error('Failed to create project', error)
    },
  })
}

/** Wraps `PATCH /dashboard/projects/:id` — the settings name field's save handler. */
export function useRenameProject(projectId: string) {
  const { getToken } = useAuth()
  return useMutation({
    mutationFn: async (name: string) => {
      const token = await getToken()
      return dashboardApi.updateProject(token, projectId, name)
    },
  })
}
