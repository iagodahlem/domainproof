import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { createClerkClient } from '@clerk/backend'
import { STATE_FILE } from './global-setup'

/** Best-effort cleanup of the test user `global-setup.ts` created — never fails the run. */
export default async function globalTeardown() {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8')
    const { userId } = JSON.parse(raw) as { userId: string }
    const secretKey = process.env.CLERK_SECRET_KEY
    if (secretKey && userId) {
      await createClerkClient({ secretKey }).users.deleteUser(userId)
    }
  } catch {
    // best-effort only — a leftover test user in the dev instance isn't fatal
  } finally {
    await rm(path.join(process.cwd(), 'e2e/.tmp'), {
      recursive: true,
      force: true,
    })
  }
}
