import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useRouter } from 'next/navigation'
import { useCreateProject } from '@/lib/query/projects'
import type { CreateProjectResult } from '@/lib/api/dashboard'
import { CreateProjectFlow } from './create-project-flow'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/lib/query/projects', () => ({
  useCreateProject: vi.fn(),
}))

const mockUseRouter = vi.mocked(useRouter)
const mockUseCreateProject = vi.mocked(useCreateProject)

const PREVIOUS_PROJECT = { id: 'proj_old', name: "Iago's project" }

const CREATE_RESULT = {
  project: {
    id: 'proj_new',
    name: 'New project',
    slug: 'new-project',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  keys: {
    test: {
      key: 'dp_test_abc',
      apiKey: {
        keyId: 'key_1',
        mode: 'test',
        maskedKey: 'dp_test_...abc',
        last4: 'iabc',
        name: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
      },
    },
    live: {
      key: 'dp_live_xyz',
      apiKey: {
        keyId: 'key_2',
        mode: 'live',
        maskedKey: 'dp_live_...xyz',
        last4: 'ixyz',
        name: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
        revokedAt: null,
      },
    },
  },
} satisfies CreateProjectResult

function mockCreateProject(data: CreateProjectResult | undefined) {
  mockUseCreateProject.mockReturnValue({
    data,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for react-query's UseMutationResult, only the fields the component reads are relevant
  } as any)
}

describe('CreateProjectFlow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only push is called
    } as any)
    vi.spyOn(window.history, 'replaceState')
  })

  it('shows the back link to the originating project on the pre-creation form', () => {
    mockCreateProject(undefined)
    render(<CreateProjectFlow previousProject={PREVIOUS_PROJECT} />)

    const link = screen.getByRole('link', { name: /back to iago's project/i })
    expect(link.getAttribute('href')).toBe('/proj_old')
  })

  it('renders no back link when there is no originating project', () => {
    mockCreateProject(undefined)
    render(<CreateProjectFlow />)

    expect(screen.queryByRole('link', { name: /back to/i })).toBeNull()
  })

  it('drops the back link once creation succeeds, on the keys handoff screen', () => {
    mockCreateProject(CREATE_RESULT)
    render(<CreateProjectFlow previousProject={PREVIOUS_PROJECT} />)

    expect(screen.getByText('New project is ready')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /back to/i })).toBeNull()
  })

  it('strips the ?from param from the URL once creation succeeds', () => {
    mockCreateProject(CREATE_RESULT)
    render(<CreateProjectFlow previousProject={PREVIOUS_PROJECT} />)

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/new')
  })

  it('never touches history when there was no originating project to clean up', () => {
    mockCreateProject(CREATE_RESULT)
    render(<CreateProjectFlow />)

    expect(window.history.replaceState).not.toHaveBeenCalled()
  })
})
