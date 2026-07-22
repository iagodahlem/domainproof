'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useMutation } from '@tanstack/react-query'
import { Button, Callout, Card, CardBody, TextField, cn } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'
import { CREATE_PROJECT_CARD_WIDTH } from '@/lib/create-project-card-width'
import { slugPreview } from '@/lib/slug-preview'
import { KeysHandoff } from './keys-handoff'

export interface CreateProjectFlowProps {
  /** Repeat visit via the dashboard shell's "New project" item rather than fresh onboarding — swaps the "first project" copy for one that doesn't assume it. */
  hasExistingProjects?: boolean
  /** First-signup only: a suggested name (derived from the caller's Clerk profile) pre-filled into the field but fully editable. Omitted for the switcher-created flow, which starts blank. */
  namePrefill?: string
}

/**
 * The create-project screen's interactive half: the name field and its
 * submit, then (on success) the show-once keys handoff — held in client
 * state rather than a route, since the keys are never retrievable again
 * once this component unmounts.
 */
export function CreateProjectFlow({
  hasExistingProjects = false,
  namePrefill,
}: CreateProjectFlowProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [name, setName] = useState(namePrefill ?? '')
  const [fieldError, setFieldError] = useState<string | undefined>()

  const createProject = useMutation({
    mutationFn: async (projectName: string) => {
      const token = await getToken()
      return dashboardApi.createProject(token, projectName)
    },
    onError: (error) => {
      console.error('Failed to create project', error)
    },
  })

  if (createProject.data) {
    const result = createProject.data
    return (
      <KeysHandoff
        result={result}
        onContinue={() =>
          router.push(`/dashboard/${result.project.id}/domains`)
        }
      />
    )
  }

  const formError = createProject.error
    ? createProject.error instanceof ApiError
      ? createProject.error.message
      : 'Something went wrong. Please try again.'
    : undefined

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setFieldError('Project name is required.')
      return
    }

    setFieldError(undefined)
    createProject.mutate(trimmed)
  }

  return (
    <Card className={cn('w-full', CREATE_PROJECT_CARD_WIDTH)}>
      <CardBody className="p-8 max-[640px]:p-6">
        <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
          Before you continue
        </p>
        <h3 className="mt-1 text-xl font-heading text-foreground">
          Name your project
        </h3>
        <p className="mt-2 text-sm leading-body text-muted-foreground">
          {hasExistingProjects ? (
            <>
              Projects group your API keys, domains, and webhooks — add another
              one for a separate product or environment.
            </>
          ) : (
            <>
              Projects group your API keys, domains, and webhooks. You&rsquo;re
              creating your first one now — add more later if you&rsquo;re
              running multiple products.
            </>
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
          <TextField
            label="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldError}
            autoComplete="off"
            autoFocus
          />
          <p className="flex flex-wrap items-center gap-1 font-mono text-xs text-faint-foreground">
            Derived DNS record:
            <strong className="font-medium text-muted-foreground">
              _{slugPreview(name)}-challenge.example.com
            </strong>
          </p>

          {formError ? <Callout tone="warning">{formError}</Callout> : null}

          <Button
            type="submit"
            variant="primary"
            loading={createProject.isPending}
            className="mt-4 w-full justify-center"
          >
            Continue
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
