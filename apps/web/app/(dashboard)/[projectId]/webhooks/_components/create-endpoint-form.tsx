'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Button,
  Callout,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Select,
  TextField,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type {
  CreateWebhookEndpointResult,
  Mode,
  WebhookEventType,
} from '@/lib/api/dashboard'
import {
  useCreateWebhookEndpoint,
  WEBHOOK_EVENT_TYPES,
} from '@/lib/query/webhooks'

export interface CreateEndpointFormProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (result: CreateWebhookEndpointResult) => void
}

const MODE_OPTIONS = [
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
]

/** Pre-checked so the common case — get notified when a domain settles, either way — takes zero clicks; every other event stays opt-in. */
const DEFAULT_EVENT_TYPES: WebhookEventType[] = [
  'domain.verified',
  'domain.failed',
]

/**
 * The "Add endpoint" drawer: URL, mode, and a checkbox per subscribable
 * event type from the API's event map. Stays mounted (just hidden) between
 * opens, same as `AddDomainForm` — so field/error state resets on every
 * open rather than lingering from the previous attempt.
 */
export function CreateEndpointForm({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: CreateEndpointFormProps) {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<Mode>('test')
  const [eventTypes, setEventTypes] = useState<Set<WebhookEventType>>(
    new Set(DEFAULT_EVENT_TYPES),
  )
  const [urlError, setUrlError] = useState<string>()
  const [formError, setFormError] = useState<string>()

  const createEndpoint = useCreateWebhookEndpoint(projectId)

  useEffect(() => {
    if (open) {
      setUrl('')
      setMode('test')
      setEventTypes(new Set(DEFAULT_EVENT_TYPES))
      setUrlError(undefined)
      setFormError(undefined)
    }
  }, [open])

  function toggleEventType(type: WebhookEventType) {
    setEventTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setUrlError('Endpoint URL is required.')
      return
    }
    setUrlError(undefined)

    if (eventTypes.size === 0) {
      setFormError('Select at least one event to send.')
      return
    }
    setFormError(undefined)

    createEndpoint.mutate(
      { url: trimmedUrl, mode, eventTypes: [...eventTypes] },
      {
        onSuccess: onCreated,
        onError: (err) => {
          console.error('Failed to create webhook endpoint', err)
          setFormError(
            err instanceof ApiError
              ? err.message
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
        if (!createEndpoint.isPending) onOpenChange(next)
      }}
    >
      <DrawerContent
        onEscapeKeyDown={(event) => {
          if (createEndpoint.isPending) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (createEndpoint.isPending) event.preventDefault()
        }}
      >
        <DrawerHeader title="Add an endpoint" />
        <DrawerBody>
          <form
            id="add-endpoint-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <TextField
              label="Endpoint URL"
              type="url"
              placeholder="https://api.yourapp.com/webhooks/domainproof"
              value={url}
              onChange={(changeEvent) => {
                setUrl(changeEvent.target.value)
                setUrlError(undefined)
              }}
              error={urlError}
              autoComplete="off"
              autoFocus
            />

            <Select
              label="Mode"
              options={MODE_OPTIONS}
              value={mode}
              onChange={(changeEvent) =>
                setMode(changeEvent.target.value as Mode)
              }
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Events to send
              </span>
              <div className="flex flex-col gap-1">
                {WEBHOOK_EVENT_TYPES.map((type) => (
                  <Checkbox
                    key={type}
                    label={type}
                    checked={eventTypes.has(type)}
                    onChange={() => toggleEventType(type)}
                    className="font-mono text-xs"
                  />
                ))}
              </div>
            </div>

            {formError ? <Callout tone="warning">{formError}</Callout> : null}
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button
            type="button"
            className="justify-center"
            onClick={() => onOpenChange(false)}
            disabled={createEndpoint.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-endpoint-form"
            variant="primary"
            className="justify-center"
            loading={createEndpoint.isPending}
          >
            Add endpoint
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
