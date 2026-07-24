import { randomBytes } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const VISITOR_COOKIE = 'dp_demo_visitor'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24

export function getVisitorId(req: NextRequest): string | null {
  return req.cookies.get(VISITOR_COOKIE)?.value ?? null
}

/** A visitor id is a bare anti-collision token, not a credential of its own — nothing sensitive is keyed by it beyond "which scan/claim belongs to this browser", so 24 random bytes is plenty against guessing. */
export function ensureVisitorId(req: NextRequest): {
  visitorId: string
  isNew: boolean
} {
  const existing = getVisitorId(req)
  if (existing) {
    return { visitorId: existing, isNew: false }
  }
  return { visitorId: randomBytes(24).toString('base64url'), isNew: true }
}

export function setVisitorCookie(res: NextResponse, visitorId: string): void {
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: '/demo',
  })
}
