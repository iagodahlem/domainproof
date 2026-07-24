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
  it("doesn't show a project's slug when its name is unique in the list", async () => {
    const user = userEvent.setup()
    const acme = project({ id: 'proj_1', name: 'Acme', slug: 'acme' })
    const beta = project({ id: 'proj_2', name: 'Beta', slug: 'beta' })
    render(<ProjectSwitcher projects={[acme, beta]} activeProject={acme} />)

    await user.click(screen.getByRole('button', { name: 'Acme' }))

    const item = screen.getByRole('menuitem', { name: 'Acme' })
    expect(item.textContent).not.toContain('acme')
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

  it('always shows the active project name, even when its name collides with another project', async () => {
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
    render(
      <ProjectSwitcher projects={[first, second]} activeProject={second} />,
    )

    await user.click(screen.getByRole('button', { name: 'iagodahlem' }))

    const activeItem = screen
      .getAllByRole('menuitem')
      .find((item) => item.textContent?.includes('x7k9p2'))
    // The name must render alongside the slug, not be replaced by it —
    // exact match guards against the name silently dropping out.
    expect(activeItem?.textContent).toBe('iagodahlemiagodahlem-x7k9p2')
  })

  it('only shows slugs for the colliding names, not the unique ones, in a mixed list', async () => {
    const user = userEvent.setup()
    const acmeOne = project({ id: 'proj_1', name: 'Acme', slug: 'acme' })
    const acmeTwo = project({
      id: 'proj_2',
      name: 'Acme',
      slug: 'acme-x7k9p2',
    })
    const sitegrade = project({
      id: 'proj_3',
      name: 'Sitegrade',
      slug: 'sitegrade',
    })
    render(
      <ProjectSwitcher
        projects={[acmeOne, acmeTwo, sitegrade]}
        activeProject={sitegrade}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Sitegrade' }))

    const items = screen.getAllByRole('menuitem')
    const sitegradeItem = items.find((item) =>
      item.textContent?.startsWith('Sitegrade'),
    )
    expect(sitegradeItem?.textContent).not.toContain('sitegrade')

    const acmeItems = items.filter((item) => item.textContent?.includes('Acme'))
    expect(acmeItems).toHaveLength(2)
    expect(
      acmeItems.some((item) => item.textContent?.includes('acme-x7k9p2')),
    ).toBe(true)
  })
})
