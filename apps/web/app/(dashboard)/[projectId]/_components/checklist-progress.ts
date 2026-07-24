import type { TimelineStepStatus } from '@domainproof/ui'

export interface ChecklistStepInfo {
  id: 'create-project' | 'first-run' | 'add-webhook'
  status: TimelineStepStatus
}

export interface ChecklistProgress {
  steps: ChecklistStepInfo[]
  /** Steps completed, out of 3 — drives the "N of 3 done" meta and the progress bar. */
  doneCount: number
  /**
   * True once both non-optional steps (create project, first run) are
   * done — the collapse-to-strip threshold. The third step (webhook) is
   * explicitly optional, so it never gates the collapse.
   */
  requiredDone: boolean
}

export interface ChecklistProgressInput {
  /** Whether any domain in this project has ever reached `verified`. */
  anyDomainVerified: boolean
  /** Whether this project has registered at least one webhook endpoint, in any mode. */
  anyWebhookRegistered: boolean
}

/**
 * The "Get started" checklist's 3 steps, derived entirely from real project
 * data — never a locally-tracked "did the user click through this" flag.
 * "Create your project" is always done (this view only renders once a
 * project exists), "First run" is done once any domain has been claimed
 * and verified, "Add a webhook" (optional) once any endpoint is
 * registered — so a user who verifies via any integration path sees the
 * same progress, regardless of which tab they used.
 */
export function deriveChecklistProgress({
  anyDomainVerified,
  anyWebhookRegistered,
}: ChecklistProgressInput): ChecklistProgress {
  const steps: ChecklistStepInfo[] = [
    { id: 'create-project', status: 'done' },
    { id: 'first-run', status: anyDomainVerified ? 'done' : 'current' },
    { id: 'add-webhook', status: anyWebhookRegistered ? 'done' : 'upcoming' },
  ]

  const doneCount = steps.filter((step) => step.status === 'done').length

  return {
    steps,
    doneCount,
    requiredDone: anyDomainVerified,
  }
}
