/**
 * A claim's `frontendToken` is the last path segment of its
 * `verificationUrl` — the public v1 API only ever exposes the URL, never
 * the raw token (see `apps/api/src/shared/verification-url.ts`'s
 * `buildVerificationUrl`), so this is the intended way to recover it.
 * `null` only if the URL is ever shaped unexpectedly.
 */
export function frontendTokenFromVerificationUrl(
  verificationUrl: string,
): string | null {
  try {
    const segments = new URL(verificationUrl).pathname
      .split('/')
      .filter(Boolean)
    return segments.at(-1) ?? null
  } catch {
    return null
  }
}
