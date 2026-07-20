import type { AccountsService } from '@modules/accounts/service'
import type { ProjectsRepository } from './repository'

export interface ProjectsService {
  /**
   * Resolves the project a Clerk-authenticated caller is acting on,
   * bootstrapping their account (and its default project) on first call.
   */
  getDefaultProjectId(clerkUserId: string): Promise<string>

  /**
   * A project's brand slug, used by other modules (e.g. `domains`) to build
   * branded verification records. Returns `undefined` if `projectId`
   * doesn't exist — callers that got the id from an authenticated context
   * (an api key already resolved to a project) shouldn't normally see this.
   */
  getProjectSlug(projectId: string): Promise<string | undefined>
}

export function createProjectsService(
  repository: ProjectsRepository,
  accountsService: AccountsService,
): ProjectsService {
  return {
    async getDefaultProjectId(clerkUserId) {
      const { accountId } = await accountsService.ensureAccount(clerkUserId)

      const projectId = await repository.findDefaultProjectId(accountId)
      if (!projectId) {
        // Cannot happen: ensureAccount guarantees a default project exists
        // for every account (created atomically alongside it).
        throw new Error(`No project found for account ${accountId}`)
      }

      return projectId
    },

    async getProjectSlug(projectId) {
      return repository.findSlugById(projectId)
    },
  }
}
