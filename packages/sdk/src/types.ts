import type { components } from './generated/openapi-types'

type GeneratedDomain = components['schemas']['Domain']

/**
 * A domain's position in DomainProof's verification pipeline.
 *
 * - `not_started` — claimed but no verification challenge issued yet.
 * - `pending` — challenge issued; waiting for the DNS/HTTP record to be
 *   published and to propagate.
 * - `verified` — the record was found and matched.
 * - `temporarily_failed` — a previously verified domain's record went
 *   missing or changed; it has a 72h grace window to recover before
 *   dropping to `failed`.
 * - `failed` — verification window elapsed, or the grace window did,
 *   with no passing check. Call `regenerate` to get a fresh challenge
 *   and restart from `pending`.
 */
export type DomainStatus =
  'not_started' | 'pending' | 'verified' | 'temporarily_failed' | 'failed'

/** One instruction for the record to publish — currently always a `TXT` record; see {@link Domain.records}. */
export interface DomainRecord extends Omit<
  GeneratedDomain['records'][number],
  'status'
> {
  status: DomainStatus
}

/**
 * A domain claimed under your project, as returned by every `domains.*`
 * method. `records` lists the DNS record(s) to publish — for a freshly
 * claimed or regenerated domain, that's exactly one `TXT` record.
 */
export interface Domain extends Omit<GeneratedDomain, 'status' | 'records'> {
  status: DomainStatus
  records: DomainRecord[]
}

/** The result of the most recent verification attempt for a domain — see {@link VerifyDomainResult}. */
export type Check = components['schemas']['Check']

/** A timeline entry for a domain (claimed, verified, failed, ...), as returned by {@link DomainProof.domains.listEvents}. */
export type Event = components['schemas']['Event']

/** Input to {@link DomainProof.domains.claim}. */
export interface ClaimDomainInput {
  /** The hostname to claim, e.g. `'acme.com'` or a subdomain like `'app.acme.com'`. */
  domain: string
  /**
   * Your own identifier for whoever owns this domain — a user id, org id,
   * or similar. Not interpreted by DomainProof; use it to correlate a
   * claim with your own records, and to filter with
   * {@link DomainProof.domains.list}'s `externalId` param.
   */
  externalId?: string
}

/** Query params for {@link DomainProof.domains.list}. */
export interface ListDomainsParams {
  /** Max domains to return, up to 100. Defaults to 20. */
  limit?: number
  /** Opaque pagination cursor from a previous page's `nextCursor`. */
  cursor?: string
  /** Filter to domains claimed with this {@link ClaimDomainInput.externalId}. */
  externalId?: string
  /** Filter to this exact domain. */
  domain?: string
}

/** Query params for {@link DomainProof.domains.listEvents}. */
export interface ListEventsParams {
  /** Max events to return, up to 100. Defaults to 20. */
  limit?: number
  /** Opaque pagination cursor from a previous page's `nextCursor`. */
  cursor?: string
}

/** Input to {@link DomainProof.componentSessions.create}. */
export interface CreateComponentSessionInput {
  /** Same meaning as {@link ClaimDomainInput.externalId} — carried through to whichever domain the component ends up claiming. */
  externalId?: string
}

/** A page of {@link DomainProof.domains.list} results. */
export interface DomainPage {
  domains: Domain[]
  /** Pass to {@link ListDomainsParams.cursor} to fetch the next page, or `null` if this is the last page. */
  nextCursor: string | null
}

/** A page of {@link DomainProof.domains.listEvents} results. */
export interface EventPage {
  events: Event[]
  /** Pass to {@link ListEventsParams.cursor} to fetch the next page, or `null` if this is the last page. */
  nextCursor: string | null
}

/** Result of {@link DomainProof.domains.verify} — the domain's (possibly updated) status plus the check that produced it. */
export interface VerifyDomainResult {
  domain: Domain
  check: Check
}

/** A session token minted by {@link DomainProof.componentSessions.create}, meant to be handed to a drop-in frontend component — never to the end user's browser directly as your api key. */
export interface ComponentSession {
  /** Single-use; spent by the component against the frontend API's claim endpoint. */
  sessionToken: string
  /** ISO 8601 timestamp. Short-lived — mint a fresh session per component mount rather than caching this. */
  expiresAt: string
}
