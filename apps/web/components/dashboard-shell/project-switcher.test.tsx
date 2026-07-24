import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ProjectSummary } from '@/lib/api/dashboard'
import { ProjectSwitcher } from './project-switcher'

function project(overrides: Partial<ProjectSummary>): ProjectSummary {
  return {
    id: 'proj_1',
    name: 'Acme',
    slug: 'acme',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ProjectSwitcher', () => {
  it("lists each project's slug alongside its name in the dropdown", async () => {
    const user = userEvent.setup()
    const acme = project({ id: 'proj_1', name: 'Acme', slug: 'acme' })
    render(<ProjectSwitcher projects={[acme]} activeProject={acme} />)

    await user.click(screen.getByRole('button', { name: 'Acme' }))

    const item = screen.getByRole('menuitem', { name: /Acme/ })
    expect(item.textContent).toContain('acme')
  })

  it('distinguishes two projects sharing a display name by their slug', async () => {
    const user = userEvent.setup()
    const first = project({
      id: 'proj_1',
      name: 'iagodahlem',
      slug: 'iagodahlem',
    })
    const second = project({
      id: 'proj_2',
      name: 'iagodahlem',
      slug: 'iagodahlem-x7k9p2',
    })
    render(<ProjectSwitcher projects={[first, second]} activeProject={first} />)

    await user.click(screen.getByRole('button', { name: 'iagodahlem' }))

    const items = screen.getAllByRole('menuitem')
    const projectItems = items.filter((item) =>
      item.textContent?.includes('iagodahlem'),
    )
    expect(projectItems).toHaveLength(2)

    const plainSlugItem = projectItems.find(
      (item) => !item.textContent?.includes('x7k9p2'),
    )
    const suffixedSlugItem = projectItems.find((item) =>
      item.textContent?.includes('x7k9p2'),
    )
    expect(plainSlugItem?.textContent).toContain('iagodahlem')
    expect(suffixedSlugItem?.textContent).toContain('iagodahlem-x7k9p2')
  })
})
