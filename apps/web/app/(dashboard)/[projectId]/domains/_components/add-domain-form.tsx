'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Callout, Select, TextField } from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type { DomainDetail, DomainMode } from '@/lib/api/dashboard'
import { useCreateDomain } from '@/lib/query/domains'

const MODE_OPTIONS = [
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
]

export interface AddDomainFormProps {
  projectId: string
  /** Pre-fills the domain field — used by the empty state's sandbox-domain shortcut. */
  initialDomain?: string
  onCreated: (domain: DomainDetail) => void
  onCancel: () => void
}

/**
 * The "+ Add domain" panel: domain input + mode select + Add/Cancel, laid
 * out in one row with `items-end` so the buttons line up with the fields'
 * inputs rather than their labels.
 */
export function AddDomainForm({
  projectId,
  initialDomain = '',
  onCreated,
  onCancel,
}: AddDomainFormProps) {
  const [domain, setDomain] = useState(initialDomain)
  const [mode, setMode] = useState<DomainMode>('test')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | undefined>()

  const createDomain = useCreateDomain(projectId)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = domain.trim()
    if (!trimmed) {
      setFieldError('Domain is required.')
      return
    }

    setFieldError(undefined)
    setFormError(undefined)
    createDomain.mutate(
      { domain: trimmed, mode },
      {
        onSuccess: ({ domain: created }) => onCreated(created),
        onError: (error) => {
          setFormError(
            error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again.',
          )
        },
      },
    )
  }

  return (
    <div className="mb-6 rounded-lg border border-border p-6">
      <div className="mb-4 font-mono text-xs font-semibold tracking-label text-muted-foreground uppercase">
        Add a domain
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <TextField
              label="Domain"
              placeholder="example.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              error={fieldError}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="w-32">
            <Select
              label="Mode"
              options={MODE_OPTIONS}
              value={mode}
              onChange={(event) => setMode(event.target.value as DomainMode)}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={createDomain.isPending}
          >
            Add domain
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            disabled={createDomain.isPending}
          >
            Cancel
          </Button>
        </div>
        {formError ? <Callout tone="warning">{formError}</Callout> : null}
        <p className="text-sm text-muted-foreground">
          We&rsquo;ll generate a unique TXT record and a hosted verification
          link right after this — same record shown on the domain&rsquo;s detail
          page.
        </p>
      </form>
    </div>
  )
}
