'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Button, Card, CardBody, TextField } from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type { ProjectSummary } from '@/lib/api/dashboard'
import { useRenameProject } from '@/lib/query/projects'

export interface ProjectNameCardProps {
  project: ProjectSummary
}

type SaveStatus = 'idle' | 'saving' | 'saved'

const SAVED_FLASH_MS = 1500
const SAVED_BUTTON_CLASSES =
  'border-success-tint-strong bg-success-soft text-success hover:bg-success-soft'

/**
 * The name field's full save flow (no-changes/edited/saving/inline-error/
 * saved), matching the approved states gallery — one field, `Save`
 * disabled until the value actually differs from what's persisted.
 */
export function ProjectNameCard({ project }: ProjectNameCardProps) {
  const [savedName, setSavedName] = useState(project.name)
  const [draft, setDraft] = useState(project.name)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string>()

  const renameProject = useRenameProject(project.id)

  const trimmed = draft.trim()
  const dirty = trimmed !== savedName
  const canSave = dirty && status !== 'saving'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return

    if (!trimmed) {
      setError("Project name can't be empty.")
      return
    }

    setError(undefined)
    setStatus('saving')
    renameProject.mutate(trimmed, {
      onSuccess: ({ project: updated }) => {
        setSavedName(updated.name)
        setDraft(updated.name)
        setStatus('saved')
        setTimeout(
          () =>
            setStatus((current) => (current === 'saved' ? 'idle' : current)),
          SAVED_FLASH_MS,
        )
      },
      onError: (err) => {
        console.error('Failed to rename project', err)
        setError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
        )
        setStatus('idle')
      },
    })
  }

  return (
    <Card className="max-w-xl">
      <CardBody>
        <h3 className="mb-5 text-lg font-heading text-foreground">
          Project settings
        </h3>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Project name"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setError(undefined)
              setStatus((current) => (current === 'saved' ? 'idle' : current))
            }}
            error={error}
            disabled={status === 'saving'}
            autoComplete="off"
            trailing={
              <Button
                type="submit"
                variant="primary"
                disabled={!canSave}
                loading={status === 'saving'}
                className={
                  status === 'saved' ? SAVED_BUTTON_CLASSES : undefined
                }
              >
                {status === 'saved' ? (
                  <>
                    <Check aria-hidden="true" size={13} />
                    Saved
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            }
          />
        </form>
        <p className="mt-3 text-xs text-faint-foreground">
          Your project slug (<code className="font-mono">{project.slug}</code>)
          and existing DNS record names stay the same — renaming your project
          never changes them.
        </p>
      </CardBody>
    </Card>
  )
}
