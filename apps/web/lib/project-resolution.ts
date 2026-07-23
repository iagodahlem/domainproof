import { dashboardApi, type ProjectSummary } from './api/dashboard'

/**
 * The caller's default project when none is specified — their first
 * project by list order, or `undefined` with no projects yet. Same rule
 * `[projectId]/layout.tsx` falls back to for an unrecognized project
 * segment.
 */
export function pickActiveProject(
  projects: ProjectSummary[],
): ProjectSummary | undefined {
  return projects[0]
}

/**
 * Where a signed-in caller with no project context yet should land: their
 * active project, or `/new` if they have none. Swallows fetch failures
 * (falls back to `/new`, which renders its own retry state) rather than
 * throwing, since `/app` — the sole caller, every "Dashboard" link and the
 * post sign-in/sign-up flow's resolver — needs a redirect target, not an
 * error boundary.
 */
export async function resolveActiveProjectPath(
  token: string | null,
): Promise<string> {
  try {
    const { projects } = await dashboardApi.listProjects(token)
    const activeProject = pickActiveProject(projects)
    return activeProject ? `/${activeProject.id}` : '/new'
  } catch (error) {
    console.error('Failed to resolve active project', error)
    return '/new'
  }
}
