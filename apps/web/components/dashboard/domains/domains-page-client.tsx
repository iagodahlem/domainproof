'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ChevronDown, Plus } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  DomainTable,
  DomainTableHead,
  DomainTableRow,
} from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import {
  dashboardApi,
  type DomainDetail,
  type DomainSummary,
} from '@/lib/api/dashboard'
import { domainStatusPresentation } from './domain-status'
import { formatRelativeTime } from './format-relative-time'
import { AddDomainForm } from './add-domain-form'
import { DomainEmptyState } from './domain-empty-state'

const SANDBOX_DOMAIN_PREFILL = 'pending-then-verified.test'

export interface DomainsPageClientProps {
  projectId: string
  initialDomains: DomainSummary[]
  initialNextCursor: string | null
}

function modePillTone(mode: DomainSummary['mode']) {
  return mode === 'live' ? ('success' as const) : ('warning' as const)
}

export function DomainsPageClient({
  projectId,
  initialDomains,
  initialNextCursor,
}: DomainsPageClientProps) {
  const router = useRouter()
  const { getToken } = useAuth()
  const [domains, setDomains] = useState(initialDomains)
  const [nextCursor, setNextCursor] = useState(initialNextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | undefined>()
  const [addFormState, setAddFormState] = useState<
    { open: false } | { open: true; prefill?: string }
  >({ open: false })

  function goToDomain(domainId: string) {
    router.push(`/dashboard/${projectId}/domains/${domainId}`)
  }

  function handleCreated(created: DomainDetail) {
    setDomains((current) => [created, ...current])
    setAddFormState({ open: false })
    goToDomain(created.id)
  }

  async function handleLoadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    setLoadMoreError(undefined)
    try {
      const token = await getToken()
      const result = await dashboardApi.listDomains(token, projectId, {
        cursor: nextCursor,
      })
      setDomains((current) => [...current, ...result.domains])
      setNextCursor(result.nextCursor)
    } catch (error) {
      setLoadMoreError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading text-text">Domains</h1>
        {!addFormState.open ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddFormState({ open: true })}
          >
            <Plus aria-hidden="true" size={13} />
            Add domain
          </Button>
        ) : null}
      </div>

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
                provider={
                  <Badge tone={modePillTone(domain.mode)} mode>
                    {domain.mode === 'live' ? 'Live' : 'Test'}
                  </Badge>
                }
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
                loading={loadingMore}
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
