import type { AccountsService } from '@modules/accounts/service'
import type { CreateKeyResult, KeysService } from '@modules/keys/service'
import { deriveProjectSlug } from './domain/brand'
import type { ProjectRow, ProjectsRepository } from './repository'

export interface ProjectSummary {
  id: string
  name: string
  slug: string
  createdAt: Date
}

export interface CreateProjectResult {
  project: ProjectSummary
  /**
   * Both keys' one-time full strings, alongside the account, in one
   * transaction — the only response where a project's bootstrap keys are
   * ever returned together. Neither is ever shown again after this.
   */
  keys: {
    test: CreateKeyResult
    live: CreateKeyResult
  }
}

export interface ProjectsService {
  /** Bootstraps the caller's account (see `accountsService.ensureAccount`) and lists its projects — empty for a fresh account. */
  listProjects(
    clerkUserId: string,
    emailHint?: string,
  ): Promise<ProjectSummary[]>

  /**
   * Bootstraps the caller's account and creates a new, named project with
   * both a test and a live API key minted alongside it, atomically. Slug
   * is derived from `name` via `deriveProjectSlug` — collisions with other
   * projects' slugs are allowed by design (verification records are
   * project-scoped, not slug-unique).
   */
  createProject(
    clerkUserId: string,
    name: string,
    emailHint?: string,
  ): Promise<CreateProjectResult>

  /**
   * Resolves `projectId` only if it belongs to the account `clerkUserId`
   * bootstraps to. Returns `undefined` otherwise — the caller (dashboard
   * keys routes) surfaces this as a 404, whether the project doesn't
   * exist or just isn't the caller's.
   */
  resolveOwnedProject(
    clerkUserId: string,
    projectId: string,
    emailHint?: string,
  ): Promise<string | undefined>

  /**
   * A project's brand slug, used by other modules (e.g. `domains`) to build
   * branded verification records. Returns `undefined` if `projectId`
   * doesn't exist — callers that got the id from an authenticated context
   * (an api key already resolved to a project) shouldn't normally see this.
   */
  getProjectSlug(projectId: string): Promise<string | undefined>

  /**
   * A project's display name — used by other modules (e.g. the Frontend
   * API's hosted verification page) that need to render "who this
   * verification belongs to" without exposing the account or project id
   * itself. Returns `undefined` if `projectId` doesn't exist, same
   * contract as `getProjectSlug`.
   */
  getProjectName(projectId: string): Promise<string | undefined>

  /**
   * Renames a project. Callers must resolve `projectId` via
   * `resolveOwnedProject` first — this method performs no ownership check
   * of its own, matching the shape `keysService`'s per-key methods use once
   * a project id is already scoped.
   *
   * Deliberately never touches `slug`: the slug is frozen at creation and
   * is not re-derived from the new name, because a domain's verification
   * record (`_<slug>-challenge.<domain>`, `<slug>-verify=<token>`) is
   * addressed by slug — shifting it out from under an already-verified
   * domain just because its project got renamed would break that domain's
   * proof without the builder touching DNS at all.
   */
  renameProject(projectId: string, name: string): Promise<ProjectSummary>
}

function toSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
  }
}

export function createProjectsService(
  repository: ProjectsRepository,
  accountsService: AccountsService,
  keysService: KeysService,
): ProjectsService {
  return {
    async listProjects(clerkUserId, emailHint) {
      const { accountId } = await accountsService.ensureAccount(
        clerkUserId,
        emailHint,
      )
      const rows = await repository.listByAccountId(accountId)
      return rows.map(toSummary)
    },

    async createProject(clerkUserId, name, emailHint) {
      const { accountId } = await accountsService.ensureAccount(
        clerkUserId,
        emailHint,
      )
      const slug = deriveProjectSlug(name)

      const testMaterial = keysService.generateKeyMaterial('test')
      const liveMaterial = keysService.generateKeyMaterial('live')

      const created = await repository.createProject(accountId, name, slug, [
        testMaterial.insert,
        liveMaterial.insert,
      ])

      const testRow = created.apiKeys.find((row) => row.mode === 'test')
      const liveRow = created.apiKeys.find((row) => row.mode === 'live')
      if (!testRow || !liveRow) {
        // Cannot happen: createProject is always called with exactly one
        // test and one live material, inserted in the same transaction as
        // the project.
        throw new Error(
          `Failed to create project ${created.project.id}: expected both a test and a live key`,
        )
      }

      return {
        project: toSummary(created.project),
        keys: {
          test: {
            key: testMaterial.key,
            apiKey: keysService.toListItem(testRow),
          },
          live: {
            key: liveMaterial.key,
            apiKey: keysService.toListItem(liveRow),
          },
        },
      }
    },

    async resolveOwnedProject(clerkUserId, projectId, emailHint) {
      const { accountId } = await accountsService.ensureAccount(
        clerkUserId,
        emailHint,
      )
      const project = await repository.findByIdForAccount(projectId, accountId)
      return project?.id
    },

    async getProjectSlug(projectId) {
      return repository.findSlugById(projectId)
    },

    async getProjectName(projectId) {
      return repository.findNameById(projectId)
    },

    async renameProject(projectId, name) {
      const updated = await repository.updateName(projectId, name)
      if (!updated) {
        // Cannot happen: callers only reach here after resolveOwnedProject
        // has already confirmed projectId exists.
        throw new Error(
          `Failed to rename project ${projectId}: no such project`,
        )
      }
      return toSummary(updated)
    },
  }
}
