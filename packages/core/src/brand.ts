/**
 * The default brand for the verification record when a builder hasn't
 * configured their own. Preserves the original hard-coded behavior for
 * every existing caller.
 */
export const DEFAULT_BRAND_SLUG = "domainproof";

/**
 * Failure reasons returned by {@link validateBrandSlug}. Kept as a closed
 * set of string codes so callers (API error taxonomy, UI copy) can switch
 * on them without parsing free-text messages.
 */
export type BrandSlugValidationFailureReason = "invalid_format" | "reserved";

export type ValidateBrandSlugResult =
  | { ok: true; slug: string }
  | { ok: false; reason: BrandSlugValidationFailureReason };

/**
 * A brand slug becomes a DNS label: `_<slug>-challenge.<domain>` and a TXT
 * value prefix `<slug>-verify=`. Lowercase letters and digits, hyphens
 * allowed in the middle only (no leading/trailing hyphen), 2-32 characters
 * total. The trailing `{0,30}` plus the two required boundary characters
 * caps the match at 32; the length check below additionally enforces the
 * 2-character floor, since the boundary-character alternative alone would
 * accept a single character.
 */
const BRAND_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const MIN_BRAND_SLUG_LENGTH = 2;
const MAX_BRAND_SLUG_LENGTH = 32;

/**
 * Slugs that must never be assignable to a builder because they collide
 * with a real DNS protocol/verification label that already has meaning at
 * an underscore-prefixed hostname, or because pairing them with our
 * `-challenge` suffix would misleadingly imply an official standard's own
 * verification step rather than a builder's product.
 */
export const RESERVED_BRAND_SLUGS: ReadonlySet<string> = new Set([
  // RFC 8555 (ACME) reserves the live `_acme-challenge` label for
  // Let's Encrypt and other ACME certificate authorities to perform
  // domain control validation. A builder named "Acme" (or anything
  // that derives to this slug) must not be able to squat the exact
  // label real ACME clients look for.
  "acme",

  // Email authentication protocols. Each of these already owns meaning
  // at an underscore-prefixed DNS label — DKIM selectors live under
  // `_domainkey`, DMARC policy lives at `_dmarc`, SPF is conventionally
  // referenced via `_spf`, BIMI's indicator lives at `_bimi`, MTA-STS's
  // policy discovery lives at `_mta-sts`, and SMTP TLS reporting uses
  // `_smtp._tls` / `_tlsrpt`. A `_<slug>-challenge` label built from any
  // of these would read as if it belonged to the email standard itself.
  "domainkey",
  "dkim",
  "dmarc",
  "spf",
  "bimi",
  "mta-sts",
  "smtp-tls",
  "tlsrpt",

  // Other protocols and products with an established underscore-prefixed
  // or well-known domain-verification convention that a
  // `_<slug>-challenge` label could be mistaken for.
  "atproto", // AT Protocol (Bluesky) domain-handle verification
  "pki-validation", // CA/Browser Forum well-known PKI validation paths
  "dnsauth", // generic DNS-based auth verification convention
  "domainconnect", // Domain Connect provisioning protocol
]);

/**
 * Validates a brand slug for use in a verification record label and value
 * prefix. Never throws — malformed or reserved input comes back as
 * `{ ok: false, reason }`, matching {@link normalizeDomain}'s style.
 *
 * Input is trimmed and lowercased before validation, so `" Acme "` and
 * `"ACME"` both normalize to `"acme"` before the reserved-word and format
 * checks run.
 */
export function validateBrandSlug(slug: string): ValidateBrandSlugResult {
  if (typeof slug !== "string") {
    return { ok: false, reason: "invalid_format" };
  }

  const normalized = slug.trim().toLowerCase();

  if (
    normalized.length < MIN_BRAND_SLUG_LENGTH ||
    normalized.length > MAX_BRAND_SLUG_LENGTH ||
    !BRAND_SLUG_PATTERN.test(normalized)
  ) {
    return { ok: false, reason: "invalid_format" };
  }

  if (RESERVED_BRAND_SLUGS.has(normalized)) {
    return { ok: false, reason: "reserved" };
  }

  return { ok: true, slug: normalized };
}

/**
 * Best-effort derivation of a valid brand slug from a free-text project
 * name, e.g. for defaulting a new project's slug at creation time. Lower-
 * cases the name, folds whitespace and underscores to hyphens, strips
 * everything else that isn't `[a-z0-9-]`, collapses repeated hyphens, trims
 * to the maximum slug length, and validates the result.
 *
 * Returns `null` rather than throwing when nothing valid can be derived —
 * an all-symbol/emoji name, a name that collapses to nothing, or a name
 * that happens to derive to a reserved slug (e.g. "Acme" -> "acme"). In
 * the reserved case this deliberately does not fall back to some mangled
 * variant: the caller should prompt for an explicit slug instead.
 */
export function slugFromName(name: string): string | null {
  if (typeof name !== "string") {
    return null;
  }

  const candidate = name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BRAND_SLUG_LENGTH)
    .replace(/-+$/g, ""); // slicing to the length cap can re-expose a trailing hyphen

  const result = validateBrandSlug(candidate);
  return result.ok ? result.slug : null;
}
