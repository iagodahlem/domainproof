import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClerkClient } from '@clerk/backend'
import { clerkSetup } from '@clerk/testing/playwright'

const STATE_DIR = path.join(process.cwd(), 'e2e/.tmp')
export const STATE_FILE = path.join(STATE_DIR, 'e2e-user.json')

/**
 * Runs once before the suite: fetches Clerk's testing token (bypasses bot
 * protection), creates one fresh test user via the Backend API, and mints
 * that user a one-time sign-in token — the suite consumes it with the
 * `ticket` strategy, never a real Google OAuth screen.
 *
 * Doesn't attach an email to the created user: this dev instance has the
 * "Email address" user attribute disabled entirely (Backend API rejects
 * both `users.createUser({ emailAddress })` and
 * `emailAddresses.createEmailAddress` with `feature_not_enabled`) — see
 * the email-claim finding in the signup PR this test was written for. A
 * sign-in token still needs *some* identification to attach to, so the
 * user gets a throwaway username instead (the one identifier type this
 * instance allows the Backend API to set directly).
 *
 * User id + ticket are handed to the spec via a gitignored state file
 * since globalSetup and the test workers don't share a process.
 * `global-teardown.ts` deletes the user afterward.
 */
export default async function globalSetup() {
  await clerkSetup()

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to run the e2e suite.')
  }

  const clerkClient = createClerkClient({ secretKey })

  const user = await clerkClient.users.createUser({
    username: `dp_e2e_${process.pid}_${Math.floor(Math.random() * 1e6)}`,
    firstName: 'DomainProof E2E',
  })
  const signInToken = await clerkClient.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 300,
  })

  await mkdir(STATE_DIR, { recursive: true })
  await writeFile(
    STATE_FILE,
    JSON.stringify({ userId: user.id, ticket: signInToken.token }),
  )
}
