import type { DnsResolver, TxtResolutionFailureReason } from "./resolver.js";
import { parseRecordValue, tokensMatch } from "./token.js";

/**
 * How many `wrong_value` records to surface for the expected/detected diff
 * shown to the user. A hostname with dozens of stray TXT records shouldn't
 * blow up the response — ten is plenty to show "here's what we found
 * instead" without needing pagination.
 */
const MAX_DETECTED_VALUES = 10;

/**
 * Outcome of checking a hostname's TXT records against an expected
 * verification token, discriminated by `outcome`:
 *
 * - `found` — some record at the hostname parses as a DomainProof record
 *   and its token matches. Any-match semantics: other unrelated TXT records
 *   (SPF, DKIM, other verification products) or other DomainProof records
 *   (a different pending verification sharing the same label) don't prevent
 *   a match — only one needs to be right.
 * - `wrong_value` — at least one record parses as a DomainProof record, but
 *   none match the expected token. `detected` carries the parsed
 *   (prefix-stripped) values found, capped at {@link MAX_DETECTED_VALUES},
 *   for an expected-vs-detected diff in the UI.
 * - `not_found` — resolution succeeded (or came back nxdomain/no_records)
 *   but no record parses as a DomainProof record. nxdomain and no_records
 *   both collapse into this outcome: from the domain owner's perspective the
 *   record simply isn't visible yet, which reads the same whether that's
 *   because the zone doesn't exist, has no TXT records, or has TXT records
 *   that aren't ours.
 * - `unreachable` — the resolver could not get an authoritative answer
 *   (timeout or server failure). This is deliberately distinct from
 *   `not_found`: it means "we don't know" rather than "it's not there yet",
 *   which should drive different guidance (retry later vs. check your DNS
 *   provider) instead of being read as a failed check.
 */
export type TxtCheckResult =
  | { outcome: "found" }
  | { outcome: "wrong_value"; detected: string[] }
  | { outcome: "not_found" }
  | { outcome: "unreachable" };

/**
 * Throws only on a type-system violation (a resolver failure reason the
 * switch below doesn't know about) — unreachable at runtime as long as the
 * switch stays exhaustive. Mirrors the `assertNever` pattern in states.ts.
 */
function assertNever(value: never): never {
  throw new Error(`Unhandled DNS failure reason in checkTxt: ${JSON.stringify(value)}`);
}

function resultForFailure(reason: TxtResolutionFailureReason): TxtCheckResult {
  switch (reason) {
    case "nxdomain":
    case "no_records":
      return { outcome: "not_found" };
    case "timeout":
    case "server_failure":
      return { outcome: "unreachable" };
    default:
      return assertNever(reason);
  }
}

/**
 * Options for {@link checkTxt}.
 */
export type CheckTxtOptions = {
  /**
   * Which brand's record prefix to parse against, defaulting to the
   * DomainProof brand. Must match the brand slug used to generate the
   * challenge (via {@link recordValue}) — brands are namespaces, so a
   * record published under one brand is invisible to a check made under
   * another.
   */
  brandSlug?: string;
};

/**
 * Checks whether `hostname` publishes a TXT record proving `expectedToken`.
 *
 * Pure aside from the injected `resolver` call: given the same resolution,
 * this always produces the same outcome. All DNS IO happens behind
 * {@link DnsResolver}, so this function never throws — resolver failures are
 * values, and are mapped to `not_found` or `unreachable` depending on
 * whether they mean "not visible yet" or "couldn't get an answer".
 */
export async function checkTxt(
  resolver: DnsResolver,
  hostname: string,
  expectedToken: string,
  options?: CheckTxtOptions,
): Promise<TxtCheckResult> {
  const resolution = await resolver.resolveTxt(hostname);

  if (!resolution.ok) {
    return resultForFailure(resolution.reason);
  }

  const detected: string[] = [];

  for (const record of resolution.records) {
    const parsed = parseRecordValue(record, options?.brandSlug);
    if (!parsed.ok) {
      continue;
    }
    if (tokensMatch(parsed.token, expectedToken)) {
      return { outcome: "found" };
    }
    if (detected.length < MAX_DETECTED_VALUES) {
      detected.push(parsed.token);
    }
  }

  if (detected.length > 0) {
    return { outcome: "wrong_value", detected };
  }

  return { outcome: "not_found" };
}
