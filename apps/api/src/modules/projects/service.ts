import type { AccountsService } from '@modules/accounts/service'
import type { ProjectsRepository } from './repository'

export interface ProjectsService {
  /**
   * Resolves the project a Clerk-authenticated caller is acting on,
   * bootstrapping their account (and its default project) on first call.
   */
  getDefaultProjectId(clerkUserId: string): Promise<string>
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
  }
}
