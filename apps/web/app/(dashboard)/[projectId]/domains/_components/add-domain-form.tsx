'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import {
  Button,
  Callout,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Select,
  TextField,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type { DomainDetail, DomainMode } from '@/lib/api/dashboard'
import { useCreateDomain } from '@/lib/query/domains'

const MODE_OPTIONS = [
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
]

export interface AddDomainFormProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fills the domain field — used by the empty state's sandbox-domain shortcut. */
  initialDomain?: string
  /** Mode the select starts on — the page's own active mode filter, so claiming a domain from the Live tab doesn't silently default to Test. */
  defaultMode?: DomainMode
  onCreated: (domain: DomainDetail) => void
}

/**
 * The "Add domain" drawer: domain input + mode select + Add/Cancel pinned
 * to the footer. Stays mounted (just hidden) between opens, same as
 * `DeleteDomainDialog` — so field/error state resets on every open rather
 * than lingering from the previous attempt.
 */
export function AddDomainForm({
  projectId,
  open,
  onOpenChange,
  initialDomain = '',
  defaultMode = 'test',
  onCreated,
}: AddDomainFormProps) {
  const [domain, setDomain] = useState(initialDomain)
  const [mode, setMode] = useState<DomainMode>(defaultMode)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | undefined>()

  const createDomain = useCreateDomain(projectId)

  useEffect(() => {
    if (open) {
      setDomain(initialDomain)
      setMode(defaultMode)
      setFieldError(undefined)
      setFormError(undefined)
    }
  }, [open, initialDomain, defaultMode])

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
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!createDomain.isPending) onOpenChange(next)
      }}
    >
      <DrawerContent
        onEscapeKeyDown={(event) => {
          if (createDomain.isPending) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (createDomain.isPending) event.preventDefault()
        }}
      >
        <DrawerHeader title="Add a domain" />
        <DrawerBody>
          <form
            id="add-domain-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
          >
            <TextField
              label="Domain"
              placeholder="example.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              error={fieldError}
              autoComplete="off"
              autoFocus
            />
            {mode === 'test' ? (
              <p className="text-xs text-faint-foreground">
                Testing? Sandbox domains verify instantly —{' '}
                <code className="font-mono">verified.test</code>,{' '}
                <code className="font-mono">pending-then-verified.test</code>,
                and more.{' '}
                <Link
                  href="/docs/sandbox"
                  className="focus-ring-text text-accent underline"
                >
                  Full table
                </Link>
              </p>
            ) : null}
            <Select
              label="Mode"
              options={MODE_OPTIONS}
              value={mode}
              onChange={(event) => setMode(event.target.value as DomainMode)}
            />
            {formError ? <Callout tone="warning">{formError}</Callout> : null}
            <p className="text-sm text-muted-foreground">
              We&rsquo;ll generate a unique TXT record and a hosted verification
              link right after this — same record shown on the domain&rsquo;s
              detail page.
            </p>
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button
            type="button"
            className="justify-center"
            onClick={() => onOpenChange(false)}
            disabled={createDomain.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-domain-form"
            variant="primary"
            className="justify-center"
            loading={createDomain.isPending}
          >
            Add domain
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
