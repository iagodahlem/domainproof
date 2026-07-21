'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Button, Callout, Card, CardBody, TextField } from '@domainproof/ui'
import { ApiError, dashboardApi, type CreateProjectResult } from '@/lib/api'
import { slugPreview } from '@/lib/slug-preview'
import { KeysHandoff } from './keys-handoff'

/**
 * The locked create-project screen's interactive half: the name field and
 * its submit, then (on success) the show-once keys handoff — held in
 * client state rather than a route, since the keys are never retrievable
 * again once this component unmounts.
 */
export function CreateProjectFlow() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [name, setName] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CreateProjectResult | null>(null)

  if (result) {
    return (
      <KeysHandoff
        result={result}
        onContinue={() => router.push('/dashboard')}
      />
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setFieldError('Project name is required.')
      return
    }

    setFieldError(undefined)
    setFormError(undefined)
    setSubmitting(true)
    try {
      const token = await getToken()
      const created = await dashboardApi.createProject(token, trimmed)
      setResult(created)
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- one-off locked-screen card width matching the board's .lockscreen .card spec, no spacing-scale equivalent; single use
    <Card className="w-full max-w-[440px]">
      <CardBody className="p-8 max-[640px]:p-6">
        <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
          Before you continue
        </p>
        <h3 className="mt-1 text-xl font-heading text-text">
          Name your project
        </h3>
        <p className="mt-2 text-sm leading-body text-text-muted">
          Projects group your API keys, domains, and webhooks. You&rsquo;re
          creating your first one now — add more later if you&rsquo;re running
          multiple products.
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
          <p className="flex flex-wrap items-center gap-1 font-mono text-xs text-text-faint">
            Derived DNS record:
            <strong className="font-medium text-text-muted">
              _{slugPreview(name)}-challenge.example.com
            </strong>
          </p>

          {formError ? <Callout tone="warning">{formError}</Callout> : null}

          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            className="mt-4 w-full justify-center"
          >
            Continue
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
