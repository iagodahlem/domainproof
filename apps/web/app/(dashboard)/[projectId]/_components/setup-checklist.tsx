'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, X } from 'lucide-react'
import { Badge, Button, cn } from '@domainproof/ui'
import type { ProjectSummary } from '@/lib/api/dashboard'
import { formatRelativeTime } from '@/lib/format-relative-time'
import type { ChecklistProgress, ChecklistStepInfo } from './checklist-progress'
import { useChecklistCollapsed } from './onboarding-storage'

const STEP_NUMBER: Record<ChecklistStepInfo['id'], string> = {
  'create-project': '1',
  'first-run': '2',
  'add-webhook': '3',
}

const STEP_TITLE: Record<ChecklistStepInfo['id'], string> = {
  'create-project': 'Create your project',
  'first-run': 'First run',
  'add-webhook': 'Add a webhook',
}

const FIRST_RUN_DESCRIPTION =
  "Pick how you're integrating — the walkthrough below adapts, and ends with a real verified sandbox domain."

export interface SetupChecklistProps {
  project: ProjectSummary
  progress: ChecklistProgress
  /** The First-run step's own body (the integration-path tabs) — rendered inside that one row. */
  firstRunContent: ReactNode
}

/**
 * The Overview's "Get started" checklist — 3 steps derived entirely from
 * real project data (see `deriveChecklistProgress`). Stays open as a full
 * card even once the two required steps are done — finishing onboarding
 * shouldn't yank the card out from under whoever's mid-walkthrough — with a
 * success-toned progress fill as its "you're set" treatment and an explicit
 * "Dismiss" control (shown only once required steps are done) for a
 * builder who's ready to close it. That dismissal — not a data-derived
 * default — is what persists across a reload.
 */
export function SetupChecklist({
  project,
  progress,
  firstRunContent,
}: SetupChecklistProps) {
  const [collapsed, setCollapsed] = useChecklistCollapsed(project.id)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mb-6 inline-flex items-center gap-3 rounded-full border border-border bg-surface py-2 pr-3 pl-2 text-sm text-muted-foreground transition-colors duration-150 hover:border-border-strong"
      >
        <ProgressRing
          doneCount={progress.doneCount}
          complete={progress.requiredDone}
        />
        <span>
          <strong className="font-semibold text-foreground">Setup:</strong>{' '}
          {progress.doneCount} of 3 done
        </span>
        <ChevronDown
          aria-hidden="true"
          size={14}
          className="text-faint-foreground"
        />
      </button>
    )
  }

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h3 className="font-heading text-foreground">Get started</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs whitespace-nowrap text-faint-foreground">
            {progress.doneCount} of 3 done
          </span>
          <span className="h-1 w-24 flex-shrink-0 overflow-hidden rounded-full bg-surface-3">
            <span
              className={cn(
                'block h-full rounded-full',
                progress.requiredDone ? 'bg-success' : 'bg-accent',
              )}
              style={{ width: `${(progress.doneCount / 3) * 100}%` }}
            />
          </span>
          {progress.requiredDone ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(true)}
              icon={<X aria-hidden="true" size={13} />}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col">
        {progress.steps.map((step) => (
          <ChecklistStepRow
            key={step.id}
            step={step}
            projectId={project.id}
            projectName={project.name}
            projectCreatedAt={project.createdAt}
            content={step.id === 'first-run' ? firstRunContent : null}
          />
        ))}
      </div>
    </div>
  )
}

function ProgressRing({
  doneCount,
  complete,
}: {
  doneCount: number
  /** Required steps are done — draws the ring in the same success tone the individual step rows use, instead of the in-progress accent. */
  complete: boolean
}) {
  const percent = (doneCount / 3) * 100
  const fill = complete ? 'var(--color-success)' : 'var(--color-accent)'
  return (
    <span
      className="relative flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${fill} 0% ${percent}%, var(--color-surface-3) ${percent}% 100%)`,
      }}
    >
      <span className="absolute inset-1 rounded-full bg-surface" />
    </span>
  )
}

function ChecklistStepRow({
  step,
  projectId,
  projectName,
  projectCreatedAt,
  content,
}: {
  step: ChecklistStepInfo
  projectId: string
  projectName: string
  projectCreatedAt: string
  content: ReactNode
}) {
  const done = step.status === 'done'
  const description: ReactNode =
    step.id === 'create-project' ? (
      `${projectName} — created ${formatRelativeTime(projectCreatedAt)}.`
    ) : step.id === 'add-webhook' ? (
      <>
        Get notified the moment a domain&rsquo;s state changes.{' '}
        <Link
          href={`/${projectId}/webhooks`}
          className="focus-ring-text text-accent underline"
        >
          Add a webhook
        </Link>
        . Skip for now if you&rsquo;re just exploring.
      </>
    ) : (
      FIRST_RUN_DESCRIPTION
    )

  return (
    <div
      className={cn(
        'flex gap-4 border-b border-border p-5 last:border-b-0',
        step.status === 'current' && 'bg-accent/5',
      )}
    >
      <span
        className={cn(
          'mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 font-mono text-2xs font-bold',
          done && 'border-success bg-success text-success-foreground',
          step.status === 'current' &&
            'border-accent bg-surface text-accent shadow-current',
          step.status === 'upcoming' &&
            'border-border-strong bg-surface text-faint-foreground',
        )}
      >
        {done ? <Check aria-hidden="true" size={11} /> : STEP_NUMBER[step.id]}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 font-heading text-base text-foreground',
            done && 'text-muted-foreground',
          )}
        >
          {STEP_TITLE[step.id]}
          {step.id === 'add-webhook' ? (
            <Badge tone="neutral">Optional</Badge>
          ) : null}
        </div>
        <p
          className={cn(
            'mt-0.5 text-sm',
            done ? 'text-faint-foreground' : 'text-muted-foreground',
          )}
        >
          {description}
        </p>
        {content ? <div className="mt-5">{content}</div> : null}
      </div>
    </div>
  )
}
