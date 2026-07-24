'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TriangleAlert, Zap } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  RecordCard,
  RecordField,
  Table,
  TableBody,
} from '@domainproof/ui'
import type { CreateWebhookEndpointResult, Mode } from '@/lib/api/dashboard'
import { useTopbarSlot } from '@/components/dashboard-shell/topbar-slot'
import { useWebhookEndpoints, webhookEndpointsKey } from '@/lib/query/webhooks'
import { CreateEndpointForm } from './create-endpoint-form'
import { EndpointRow, EndpointTableHead } from './endpoint-row'

export interface WebhooksViewProps {
  projectId: string
  mode: Mode
}

/**
 * Endpoints table (no outer card, per the board) plus the add-endpoint
 * drawer and the show-once signing-secret reveal a successful create
 * produces. Enable/disable/delete are owned by `EndpointRow`'s own
 * mutation hooks, which sync the query cache directly — this component
 * only handles the one case where it holds data a mutation hook doesn't
 * see on its own: prepending a just-created endpoint.
 */
export function WebhooksView({ projectId, mode }: WebhooksViewProps) {
  const queryClient = useQueryClient()
  const { data: endpoints } = useWebhookEndpoints(projectId, mode)
  const [showForm, setShowForm] = useState(false)
  const [revealed, setRevealed] = useState<CreateWebhookEndpointResult | null>(
    null,
  )

  function handleCreated(result: CreateWebhookEndpointResult) {
    queryClient.setQueryData(
      webhookEndpointsKey(projectId, result.endpoint.mode),
      (current: typeof endpoints | undefined) =>
        current && [result.endpoint, ...current],
    )
    setRevealed(result)
    setShowForm(false)
  }

  useTopbarSlot({
    action: (
      <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
        + Add endpoint
      </Button>
    ),
  })

  return (
    <div>
      {revealed ? (
        <div className="mb-6 flex flex-col gap-3">
          <Callout tone="warning" className="flex items-start gap-3">
            <TriangleAlert
              aria-hidden="true"
              size={16}
              className="mt-0.5 shrink-0 text-warning-strong"
            />
            <p>
              <strong>Save this now.</strong> The signing secret is shown
              exactly once — copy it somewhere safe. You won&rsquo;t be able to
              see it again after you dismiss this.
            </p>
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

      <CreateEndpointForm
        projectId={projectId}
        open={showForm}
        onOpenChange={setShowForm}
        onCreated={handleCreated}
      />

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
            <EndpointTableHead />
            {endpoints.map((endpoint) => (
              <EndpointRow
                key={endpoint.id}
                projectId={projectId}
                endpoint={endpoint}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
