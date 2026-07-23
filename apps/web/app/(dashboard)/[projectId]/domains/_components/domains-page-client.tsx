'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus } from 'lucide-react'
import {
  Button,
  Callout,
  DomainTable,
  DomainTableHead,
  DomainTableRow,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type {
  DomainDetail,
  DomainListItem,
  DomainMode,
} from '@/lib/api/dashboard'
import { useListDomains } from '@/lib/query/domains'
import { useTopbarSlot } from '@/components/dashboard-shell/topbar-slot'
import { domainStatusPresentation } from '@/lib/domain-status'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { domainProviderBadge } from './domain-provider'
import { AddDomainForm } from './add-domain-form'
import { DomainEmptyState } from './domain-empty-state'

const SANDBOX_DOMAIN_PREFILL = 'pending-then-verified.test'

export interface DomainsPageClientProps {
  projectId: string
  mode: DomainMode
  initialDomains: DomainListItem[]
  initialNextCursor: string | null
}

export function DomainsPageClient({
  projectId,
  mode,
  initialDomains,
  initialNextCursor,
}: DomainsPageClientProps) {
  const router = useRouter()
  const [domains, setDomains] = useState(initialDomains)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [loadMoreError, setLoadMoreError] = useState<string | undefined>()
  const [addFormState, setAddFormState] = useState<
    { open: false } | { open: true; prefill?: string }
  >({ open: false })

  const listDomains = useListDomains(projectId, mode)

  function goToDomain(domainId: string) {
    router.push(`/${projectId}/domains/${domainId}`)
  }

  function handleCreated(created: DomainDetail) {
    // The create response has no `provider` (see `lib/api/dashboard.ts`'s
    // `DomainListItem` doc comment) — defaulted to 'unknown' here since
    // `handleCreated` navigates straight to the new domain's own detail
    // page, so this row is never actually seen in the table.
    setDomains((current) => [{ ...created, provider: 'unknown' }, ...current])
    setAddFormState({ open: false })
    goToDomain(created.id)
  }

  function handleLoadMore() {
    if (!nextCursor) return
    setLoadMoreError(undefined)
    listDomains.mutate(nextCursor, {
      onSuccess: (result) => {
        setDomains((current) => [...current, ...result.domains])
        setNextCursor(result.nextCursor)
      },
      onError: (error) => {
        setLoadMoreError(
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.',
        )
      },
    })
  }

  useTopbarSlot({
    action: !addFormState.open ? (
      <Button
        variant="primary"
        size="sm"
        onClick={() => setAddFormState({ open: true })}
      >
        <Plus aria-hidden="true" size={13} />
        Add domain
      </Button>
    ) : undefined,
  })

  return (
    <div>
      {addFormState.open ? (
        <AddDomainForm
          projectId={projectId}
          initialDomain={addFormState.prefill}
          onCreated={handleCreated}
          onCancel={() => setAddFormState({ open: false })}
        />
      ) : null}

      {domains.length === 0 ? (
        <DomainEmptyState
          onVerifyFirstDomain={() =>
            setAddFormState({ open: true, prefill: SANDBOX_DOMAIN_PREFILL })
          }
        />
      ) : (
        <DomainTable>
          <DomainTableHead />
          {domains.map((domain) => {
            const presentation = domainStatusPresentation(domain.status)
            return (
              <DomainTableRow
                key={domain.id}
                statusTone={presentation.tone}
                statusLabel={presentation.label}
                name={domain.domain}
                provider={domainProviderBadge(domain.domain, domain.provider)}
                lastChecked={formatRelativeTime(domain.updatedAt)}
                onSelect={() => goToDomain(domain.id)}
              />
            )
          })}
          {nextCursor ? (
            <div className="flex items-center justify-center border-t border-border bg-surface-2 px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                loading={listDomains.isPending}
              >
                Load more domains
                <ChevronDown aria-hidden="true" size={14} />
              </Button>
            </div>
          ) : null}
        </DomainTable>
      )}

      {loadMoreError ? (
        <Callout tone="warning" className="mt-4">
          {loadMoreError}
        </Callout>
      ) : null}
    </div>
  )
}
