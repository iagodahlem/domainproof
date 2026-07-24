import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import type { ProjectSummary } from '@/lib/api/dashboard'
// eslint-disable-next-line no-restricted-imports -- test spies on the dashboard plane client's export, same exception as page-client.test.tsx
import { dashboardApi } from '@/lib/api/dashboard'
import { ProjectNameCard } from './project-name-card'

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseRouter = vi.mocked(useRouter)

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'proj_1',
    name: 'Acme',
    slug: 'acme',
    createdAt: '2026-07-19T12:00:00.000Z',
    ...overrides,
  }
}

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  )
}

describe('ProjectNameCard', () => {
  it('refreshes the router on a successful rename so server-provided project data (sidebar/topbar) updates', async () => {
    mockUseAuth.mockReturnValue({
      getToken: vi.fn().mockResolvedValue('tok'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only getToken is read
    } as any)
    const refresh = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only refresh is read
    mockUseRouter.mockReturnValue({ refresh } as any)
    vi.spyOn(dashboardApi, 'updateProject').mockResolvedValue({
      project: project({ name: 'Acme Renamed' }),
    })

    renderWithProviders(<ProjectNameCard project={project()} />)

    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Acme Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1)
    })
  })

  it('does not refresh the router when the rename fails', async () => {
    mockUseAuth.mockReturnValue({
      getToken: vi.fn().mockResolvedValue('tok'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only getToken is read
    } as any)
    const refresh = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only refresh is read
    mockUseRouter.mockReturnValue({ refresh } as any)
    vi.spyOn(dashboardApi, 'updateProject').mockRejectedValue(
      new Error('failed'),
    )

    renderWithProviders(<ProjectNameCard project={project()} />)

    const input = screen.getByLabelText(/project name/i)
    fireEvent.change(input, { target: { value: 'Acme Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeTruthy()
    })
    expect(refresh).not.toHaveBeenCalled()
  })
})
