'use client'

import { Plus } from 'lucide-react'
import {
  Button,
  DomainTable,
  DomainTableHead,
  DomainTableRowSkeleton,
} from '@domainproof/ui'
import { useTopbarSlot } from '@/components/dashboard-shell/topbar-slot'

/**
 * Matches `DomainsPageClient`'s real table shape — same head, a handful of
 * row skeletons standing in for whatever page size lands. Also registers
 * the real (disabled) "Add domain" button into the topbar slot itself,
 * same as the real page does — without it, that button would pop in only
 * once `DomainsPageClient` mounts, shifting the topbar the instant data
 * arrives.
 */
export function DomainsSkeleton() {
  useTopbarSlot({
    action: (
      <Button variant="primary" size="sm" disabled>
        <Plus aria-hidden="true" size={13} />
        Add domain
      </Button>
    ),
  })

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
