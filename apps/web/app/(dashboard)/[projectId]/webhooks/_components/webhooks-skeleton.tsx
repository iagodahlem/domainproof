import {
  Skeleton,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  cn,
} from '@domainproof/ui'
import { ENDPOINT_GRID_COLS } from './endpoint-row'

/**
 * Matches `WebhooksView`'s real table shape — same grid columns as
 * `EndpointRow`, a handful of row skeletons standing in for whatever
 * endpoint count lands. The header row's labels are static (never
 * loading-dependent content), so it renders for real rather than as a
 * skeleton.
 */
export function WebhooksSkeleton() {
  return (
    <div aria-hidden="true">
      <Table>
        <TableBody>
          <TableHeader className={cn(ENDPOINT_GRID_COLS, 'max-[760px]:hidden')}>
            <span />
            <span>Endpoint URL</span>
            <span>Events</span>
            <span>Status</span>
            <span />
          </TableHeader>
          {Array.from({ length: 4 }, (_, index) => (
            <TableRow key={index} className={cn(ENDPOINT_GRID_COLS, 'py-2.5')}>
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5.5 w-16 rounded-full" />
              <span />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
