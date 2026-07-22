import { readFile } from 'node:fs/promises'
import { clerk } from '@clerk/testing/playwright'
import { expect, test } from '@playwright/test'
import { STATE_FILE } from './global-setup'

/**
 * Full signup + bootstrap loop against a live local web + api stack (see
 * `e2e/README.md`): fresh Clerk test user -> landing -> sign-in via a
 * Clerk testing token (no real Google UI) -> locked create-project screen
 * -> create -> show-once keys handoff -> dashboard placeholder.
 *
 * The first assertion after sign-in is the email-claim check itself
 * (D-045/A2): decodes the real session JWT this dev instance issues and
 * records whether `email` is present as a default claim, without assuming
 * either way.
 */
test('fresh signup reaches the dashboard placeholder with a named project', async ({
  page,
}) => {
  const { ticket } = JSON.parse(await readFile(STATE_FILE, 'utf-8')) as {
    ticket: string
  }

  await page.goto('/')
  await expect(
    page
      .getByRole('main')
      .getByRole('button', { name: /continue with google/i }),
  ).toBeVisible()

  // Bot protection's CAPTCHA widget needs this mount element present
  // before authenticateWithRedirect() runs, or Clerk rejects the sign-up
  // on any instance with bot protection enabled — a structural regression
  // guard since this dev instance itself doesn't have it turned on.
  await expect(page.locator('#clerk-captcha')).toBeAttached()

  await clerk.signIn({ page, signInParams: { strategy: 'ticket', ticket } })

  const claims = await page.evaluate(async () => {
    const token = await window.Clerk.session?.getToken()
    const payload = token?.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  })
  const emailClaimPresent = Boolean(claims && 'email' in claims)
  console.log(`[email-claim-check] present by default: ${emailClaimPresent}`)
  test.info().annotations.push({
    type: 'email-claim',
    description: `email claim present by default: ${emailClaimPresent}`,
  })

  // Fresh account, no projects yet: /dashboard redirects to the locked
  // create-project screen (routing is derived from the projects list).
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/new$/)
  await expect(
    page.getByRole('heading', { name: 'Name your project' }),
  ).toBeVisible()

  await page.getByLabel('Project name').fill('E2E Test Project')
  await page.getByRole('button', { name: 'Continue' }).click()

  // Show-once keys handoff.
  await expect(page.getByText('E2E Test Project is ready')).toBeVisible()
  await expect(page.getByText(/^dp_test_/)).toBeVisible()
  await page.getByRole('button', { name: 'Reveal' }).click()
  await expect(page.getByText(/^dp_live_/)).toBeVisible()

  await page.getByRole('button', { name: 'Continue to dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByRole('heading', { name: 'Your projects' }),
  ).toBeVisible()
  await expect(page.getByText('E2E Test Project')).toBeVisible()
})
