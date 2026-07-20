import { eq } from 'drizzle-orm'
import type { Database } from '@infra/db/client'
import { projects } from '@infra/db/schema'

/**
 * All db access for the projects module. This is the only file in
 * `modules/projects` allowed to import `@infra/db`.
 */
export interface ProjectsRepository {
  /**
   * The id of an account's "Default" project. Every account currently has
   * exactly one project, created atomically alongside the account (see
   * `modules/accounts`), so this is a stand-in for real project selection
   * until the dashboard supports multiple projects per account.
   */
  findDefaultProjectId(accountId: string): Promise<string | undefined>

  /** A project's brand slug, e.g. for building its domain verification records. */
  findSlugById(projectId: string): Promise<string | undefined>
}

export function createProjectsRepository(db: Database): ProjectsRepository {
  return {
    async findDefaultProjectId(accountId) {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.accountId, accountId))
        .limit(1)
      return project?.id
    },

    async findSlugById(projectId) {
      const [project] = await db
        .select({ slug: projects.slug })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)
      return project?.slug
    },
  }
}
