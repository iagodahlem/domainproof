import { describe, expect, it, vi } from 'vitest'
import type { ProjectSummary } from './api/dashboard'
import { dashboardApi } from './api/dashboard'
import {
  pickActiveProject,
  resolveActiveProjectPath,
} from './project-resolution'

vi.mock('./api/dashboard', () => ({
  dashboardApi: { listProjects: vi.fn() },
}))

const mockListProjects = vi.mocked(dashboardApi.listProjects)

function project(id: string): ProjectSummary {
  return { id, name: id, slug: id, createdAt: '2026-01-01T00:00:00.000Z' }
}

describe('pickActiveProject', () => {
  it('picks the first project by list order', () => {
    expect(pickActiveProject([project('a'), project('b')])).toEqual(
      project('a'),
    )
  })

  it('is undefined with no projects', () => {
    expect(pickActiveProject([])).toBeUndefined()
  })
})

describe('resolveActiveProjectPath', () => {
  it('resolves to the first project', async () => {
    mockListProjects.mockResolvedValue({ projects: [project('acme-app')] })

    expect(await resolveActiveProjectPath('token')).toBe('/acme-app')
    expect(mockListProjects).toHaveBeenCalledWith('token')
  })

  it('resolves to /new with no projects', async () => {
    mockListProjects.mockResolvedValue({ projects: [] })

    expect(await resolveActiveProjectPath('token')).toBe('/new')
  })

  it('falls back to /new if the project fetch fails', async () => {
    mockListProjects.mockRejectedValue(new Error('network error'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await resolveActiveProjectPath('token')).toBe('/new')
  })
})
