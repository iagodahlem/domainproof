'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Callout, Checkbox, Select, TextField } from '@domainproof/ui'
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
  onCreated: (result: CreateWebhookEndpointResult) => void
  onCancel: () => void
}

const MODE_OPTIONS = [
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
]

/**
 * Inline expanding panel (dashed border, no modal in this design system —
 * see `ConfirmBar`'s doc comment for the same convention) for adding a
 * webhook endpoint: URL, mode, and a checkbox per subscribable event type
 * from the API's event map.
 */
export function CreateEndpointForm({
  projectId,
  onCreated,
  onCancel,
}: CreateEndpointFormProps) {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<Mode>('test')
  const [eventTypes, setEventTypes] = useState<Set<WebhookEventType>>(new Set())
  const [urlError, setUrlError] = useState<string>()
  const [formError, setFormError] = useState<string>()

  const createEndpoint = useCreateWebhookEndpoint(projectId)

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
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-col gap-4 rounded-lg border border-dashed border-border-strong bg-surface p-6"
    >
      <h3 className="text-sm font-heading text-foreground">Add an endpoint</h3>

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
      />

      <Select
        label="Mode"
        options={MODE_OPTIONS}
        value={mode}
        onChange={(changeEvent) => setMode(changeEvent.target.value as Mode)}
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={createEndpoint.isPending}
        >
          Add endpoint
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onCancel}
          disabled={createEndpoint.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
