import {
  DomainTable,
  DomainTableHead,
  DomainTableRowSkeleton,
} from '@domainproof/ui'

/** Matches `DomainsPageClient`'s real table shape — same head, a handful of row skeletons standing in for whatever page size lands. */
export function DomainsSkeleton() {
  return (
    <div aria-hidden="true">
      <DomainTable>
        <DomainTableHead />
        <DomainTableRowSkeleton />
        <DomainTableRowSkeleton />
        <DomainTableRowSkeleton />
        <DomainTableRowSkeleton />
        <DomainTableRowSkeleton />
      </DomainTable>
    </div>
  )
}
