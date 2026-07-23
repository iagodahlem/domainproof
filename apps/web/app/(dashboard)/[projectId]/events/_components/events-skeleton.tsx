import {
  Skeleton,
  Table,
  TableBody,
  TableHeader,
  TableRow,
  cn,
} from '@domainproof/ui'
import { EVENT_GRID_COLS } from './event-row'

/**
 * Matches `EventsView`'s real table shape — same grid columns as
 * `EventRow`, a handful of row skeletons standing in for whatever page
 * size lands. The header row's labels are static (never loading-dependent
 * content), so it renders for real rather than as a skeleton.
 */
export function EventsSkeleton() {
  return (
    <div aria-hidden="true">
      <Table>
        <TableBody>
          <TableHeader className={cn(EVENT_GRID_COLS, 'max-[760px]:hidden')}>
            <span>Type</span>
            <span>Domain</span>
            <span>Mode</span>
            <span>Timestamp</span>
            <span />
          </TableHeader>
          {Array.from({ length: 6 }, (_, index) => (
            <TableRow key={index} className={EVENT_GRID_COLS}>
              <Skeleton className="h-5.5 w-16 rounded-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5.5 w-12 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <span />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
