import { Table, TableBody } from '@domainproof/ui'
import { EventRowSkeleton, EventTableHead } from './event-row'

/**
 * Matches `EventsView`'s real table shape exactly — `EventTableHead` and
 * `EventRowSkeleton` are the same components (colocated with `EventRow`
 * in `event-row.tsx`) the real table renders, so this can't structurally
 * drift from it the way a hand-duplicated header once did.
 */
export function EventsSkeleton() {
  return (
    <div aria-hidden="true">
      <Table>
        <TableBody>
          <EventTableHead />
          <EventRowSkeleton />
          <EventRowSkeleton />
          <EventRowSkeleton />
          <EventRowSkeleton />
          <EventRowSkeleton />
          <EventRowSkeleton />
        </TableBody>
      </Table>
    </div>
  )
}
