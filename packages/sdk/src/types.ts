import type { DomainStatus } from '@domainproof/core'
import type { components } from './generated/openapi-types'

type GeneratedDomain = components['schemas']['Domain']

/**
 * `status` is retyped against `@domainproof/core`'s `DomainStatus` instead
 * of the generated OpenAPI literal union — the two are structurally
 * identical today (the API's response schema is itself built from
 * `DOMAIN_STATUSES`), but this ties the SDK's public type to the one
 * canonical source rather than a second, independently regenerated copy.
 */
export interface DomainRecord extends Omit<
  GeneratedDomain['records'][number],
  'status'
> {
  status: DomainStatus
}

export interface Domain extends Omit<GeneratedDomain, 'status' | 'records'> {
  status: DomainStatus
  records: DomainRecord[]
}

export type Check = components['schemas']['Check']
export type Event = components['schemas']['Event']

export interface ClaimDomainInput {
  domain: string
  externalId?: string
}

export interface ListDomainsParams {
  limit?: number
  cursor?: string
  externalId?: string
  domain?: string
}

export interface ListEventsParams {
  limit?: number
  cursor?: string
}

export interface CreateComponentSessionInput {
  externalId?: string
}

export interface DomainPage {
  domains: Domain[]
  nextCursor: string | null
}

export interface EventPage {
  events: Event[]
  nextCursor: string | null
}

export interface VerifyDomainResult {
  domain: Domain
  check: Check
}

export interface ComponentSession {
  sessionToken: string
  expiresAt: string
}
