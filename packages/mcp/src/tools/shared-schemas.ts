import { z } from 'zod'

/** Shared across every tool that addresses a single domain by id. */
export const domainId = z
  .string()
  .min(1)
  .describe(
    "The domain's id (e.g. 'dom_abc123'), as returned by claim_domain or list_domains.",
  )

export function limit(max: number) {
  return z.coerce
    .number()
    .int()
    .positive()
    .max(max)
    .optional()
    .describe(`Max items to return, up to ${max}. Defaults to 20.`)
}

export const cursor = z
  .string()
  .min(1)
  .optional()
  .describe("Opaque pagination cursor from a previous call's nextCursor.")
