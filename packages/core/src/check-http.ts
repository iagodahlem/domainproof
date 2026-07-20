import type { HttpFetcher } from './fetcher'
import { parseRecordValue, wellKnownUrl } from './record'
import { tokensMatch } from './token'

/**
 * How many `wrong_value` records to surface for the expected/detected diff
 * shown to the user. Mirrors {@link checkTxt}'s cap so a well-known file
 * with many stray or stale lines doesn't blow up the response.
 */
const MAX_DETECTED_VALUES = 10

/**
 * Outcome of checking a domain's well-known challenge file against an
 * expected verification token, discriminated by `outcome`. Shape is
 * intentionally identical to {@link TxtCheckResult} so the API and UI can
 * handle both verification methods uniformly:
 *
 * - `found` — the file fetched successfully and at least one line parses as
 *   a DomainProof record whose token matches. Any-match semantics, same as
 *   the TXT check: multiple pending verifications can list their tokens on
 *   separate lines in the same file, and only one needs to be right.
 * - `wrong_value` — the file fetched successfully and at least one line
 *   parses as a DomainProof record, but none match the expected token.
 *   `detected` carries the parsed (prefix-stripped) values found, capped at
 *   {@link MAX_DETECTED_VALUES}.
 * - `not_found` — the server responded 404 or 410, or responded 2xx with a
 *   body that has no parseable DomainProof line. Both read the same from
 *   the domain owner's perspective: the proof simply isn't there yet.
 * - `unreachable` — the fetch failed (timeout, connection refused, TLS
 *   error, an oversized body) or the server answered with a 5xx or other
 *   non-success, non-not-found status. Deliberately distinct from
 *   `not_found`: it means "we couldn't get a straight answer" rather than
 *   "it's not there yet", which should drive different guidance (retry
 *   later vs. fix your file) instead of being read as a failed check.
 *
 * Status -> outcome mapping performed by this function:
 *
 * | Response                                   | Outcome                    |
 * |---------------------------------------------|----------------------------|
 * | 2xx                                         | inspect body (see above)   |
 * | 404, 410                                    | `not_found`                |
 * | 3xx                                         | never observed here — the  |
 * |                                              | fetcher already followed   |
 * |                                              | same-host HTTPS redirects  |
 * |                                              | internally, or reported a  |
 * |                                              | cross-host/insecure one as |
 * |                                              | `connection_failed` (see   |
 * |                                              | below)                     |
 * | fetch failure: timeout                      | `unreachable`              |
 * | fetch failure: connection_failed             | `unreachable`              |
 * | fetch failure: tls_error                     | `unreachable`              |
 * | fetch failure: too_large                     | `unreachable`              |
 * | everything else (5xx, other 4xx)             | `unreachable`              |
 *
 * A fetch failure of `connection_failed` also covers the case where the
 * fetcher attempted to follow a redirect to a different host or to a
 * non-HTTPS URL and refused — see {@link HttpFetcher}'s redirect-confinement
 * contract. That collapses into `unreachable` here just like any other
 * connection problem: from the checker's point of view both mean "couldn't
 * get an authoritative answer from this domain".
 */
export type HttpCheckResult =
  | { outcome: 'found' }
  | { outcome: 'wrong_value'; detected: string[] }
  | { outcome: 'not_found' }
  | { outcome: 'unreachable' }

const NOT_FOUND_STATUSES = new Set([404, 410])

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300
}

/**
 * Splits a well-known file body into candidate record lines. Each line is
 * parsed the same way a TXT record value is (see {@link parseRecordValue}),
 * so the file supports the same whitespace/quoting tolerance and the same
 * "one line per pending verification" layout that TXT supports via multiple
 * records at the same hostname.
 */
function candidateLines(body: string): string[] {
  return body.split(/\r?\n/).filter((line) => line.trim().length > 0)
}

/**
 * Checks whether `domain` serves a well-known challenge file proving
 * `expectedToken`.
 *
 * `brandSlug` selects the well-known filename and the record prefix to
 * parse against — see {@link checkTxt}'s doc comment; core has no default
 * brand, the caller always supplies one.
 *
 * Pure aside from the injected `fetcher` call: given the same fetch result,
 * this always produces the same outcome. All network IO happens behind
 * {@link HttpFetcher}, so this function never throws — fetch failures are
 * values, and are mapped to `not_found` or `unreachable` per the table on
 * {@link HttpCheckResult}.
 */
export async function checkHttp(
  fetcher: HttpFetcher,
  domain: string,
  expectedToken: string,
  brandSlug: string,
): Promise<HttpCheckResult> {
  const url = wellKnownUrl(domain, brandSlug)
  const result = await fetcher.fetchText(url)

  if (!result.ok) {
    return { outcome: 'unreachable' }
  }

  if (NOT_FOUND_STATUSES.has(result.status)) {
    return { outcome: 'not_found' }
  }

  if (!isSuccessStatus(result.status)) {
    return { outcome: 'unreachable' }
  }

  const detected: string[] = []

  for (const line of candidateLines(result.body)) {
    const parsed = parseRecordValue(line, brandSlug)
    if (!parsed.ok) {
      continue
    }
    if (tokensMatch(parsed.token, expectedToken)) {
      return { outcome: 'found' }
    }
    if (detected.length < MAX_DETECTED_VALUES) {
      detected.push(parsed.token)
    }
  }

  if (detected.length > 0) {
    return { outcome: 'wrong_value', detected }
  }

  return { outcome: 'not_found' }
}
