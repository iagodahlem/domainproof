'use client'

import { Button, Table, TableBody } from '@domainproof/ui'
import { useTopbarSlot } from '@/components/dashboard-shell/topbar-slot'
import { EndpointRowSkeleton, EndpointTableHead } from './endpoint-row'

/**
 * Matches `WebhooksView`'s real table shape exactly — `EndpointTableHead`
 * and `EndpointRowSkeleton` are the same components (colocated with
 * `EndpointRow` in `endpoint-row.tsx`) the real table renders, so this
 * can't structurally drift from it the way a hand-duplicated header once
 * did. Also registers the real (disabled) "+ Add endpoint" button into
 * the topbar slot itself, same reasoning as `DomainsSkeleton`'s "Add
 * domain" button — so it doesn't pop in only once the real page mounts.
 */
export function WebhooksSkeleton() {
  useTopbarSlot({
    action: (
      <Button variant="primary" size="sm" disabled>
        + Add endpoint
      </Button>
    ),
  })

  return (
    <div aria-hidden="true">
      <Table>
        <TableBody>
          <EndpointTableHead />
          <EndpointRowSkeleton />
          <EndpointRowSkeleton />
          <EndpointRowSkeleton />
          <EndpointRowSkeleton />
        </TableBody>
      </Table>
    </div>
  )
}
