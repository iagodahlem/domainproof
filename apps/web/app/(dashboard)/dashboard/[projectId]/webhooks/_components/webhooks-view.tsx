'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  RecordCard,
  RecordField,
  Table,
  TableBody,
  TableHeader,
  cn,
} from '@domainproof/ui'
import type {
  CreateWebhookEndpointResult,
  WebhookEndpointSummary,
} from '@/lib/api/dashboard'
import { CreateEndpointForm } from './create-endpoint-form'
import { EndpointRow, ENDPOINT_GRID_COLS } from './endpoint-row'

export interface WebhooksViewProps {
  projectId: string
  initialEndpoints: WebhookEndpointSummary[]
}

/**
 * Endpoints table (no outer card, per the board) plus the add-endpoint
 * inline panel and the show-once signing-secret reveal a successful
 * create produces. All endpoint mutations (enable/disable/delete) are
 * owned by `EndpointRow`, which reports the result back up here so this
 * component only ever holds the flat list.
 */
export function WebhooksView({
  projectId,
  initialEndpoints,
}: WebhooksViewProps) {
  const [endpoints, setEndpoints] = useState(initialEndpoints)
  const [showForm, setShowForm] = useState(false)
  const [revealed, setRevealed] = useState<CreateWebhookEndpointResult | null>(
    null,
  )

  function handleCreated(result: CreateWebhookEndpointResult) {
    setEndpoints((prev) => [result.endpoint, ...prev])
    setRevealed(result)
    setShowForm(false)
  }

  function handleUpdated(endpoint: WebhookEndpointSummary) {
    setEndpoints((prev) =>
      prev.map((item) => (item.id === endpoint.id ? endpoint : item)),
    )
  }

  function handleDeleted(endpointId: string) {
    setEndpoints((prev) => prev.filter((item) => item.id !== endpointId))
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-end">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
        >
          {showForm ? 'Cancel' : '+ Add endpoint'}
        </Button>
      </div>

      {revealed ? (
        <div className="mb-6 flex flex-col gap-3">
          <Callout tone="warning">
            <strong>Save this now.</strong> The signing secret is shown exactly
            once — copy it somewhere safe. You won&rsquo;t be able to see it
            again after you dismiss this.
          </Callout>
          <RecordCard
            title="New endpoint"
            sub={revealed.endpoint.url}
            trailing={<Badge tone="accent">One-time</Badge>}
          >
            <RecordField
              label="Signing secret"
              value={revealed.secret}
              copyable
            />
          </RecordCard>
          <Button
            variant="default"
            className="self-start"
            onClick={() => setRevealed(null)}
          >
            Done
          </Button>
        </div>
      ) : null}

      {showForm ? (
        <CreateEndpointForm
          projectId={projectId}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {endpoints.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Zap aria-hidden="true" size={18} />
          </div>
          <h3 className="mb-2 text-lg font-heading text-foreground">
            No endpoints yet
          </h3>
          <p className="mx-auto mb-5 max-w-[44ch] text-sm text-muted-foreground">
            Add an endpoint to start receiving domain.verified and other
            state-change events.
          </p>
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            + Add endpoint
          </Button>
        </div>
      ) : (
        <Table>
          <TableBody>
            <TableHeader
              className={cn(ENDPOINT_GRID_COLS, 'max-[760px]:hidden')}
            >
              <span />
              <span>Endpoint URL</span>
              <span>Events</span>
              <span>Status</span>
              <span />
            </TableHeader>
            {endpoints.map((endpoint) => (
              <EndpointRow
                key={endpoint.id}
                projectId={projectId}
                endpoint={endpoint}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
