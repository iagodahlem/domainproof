import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { clerk } from '@clerk/testing/playwright'
import { expect, test } from '@playwright/test'
import { STATE_FILE } from './global-setup'

/**
 * Manual visual-verification pass for the domain detail redesign — not part
 * of the regular suite (run explicitly: `playwright test
 * e2e/domain-detail.spec.ts`, never alongside `signup-flow.spec.ts` in the
 * same run, since both would try to consume the same single-use sign-in
 * ticket). Screenshots land in `.claude/artifacts/` (gitignored).
 */
const ARTIFACTS = path.join(process.cwd(), '.claude/artifacts')

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })
test.setTimeout(180_000)

test('domain detail redesign — pending, verified, failed, delete dialogs, both themes', async ({
  page,
}) => {
  const { ticket } = JSON.parse(await readFile(STATE_FILE, 'utf-8')) as {
    ticket: string
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await clerk.signIn({ page, signInParams: { strategy: 'ticket', ticket } })
  // Headless Chromium's default `prefers-color-scheme` isn't guaranteed
  // dark — force the stored preference so every following navigation's
  // no-FOUC script (which reads this before anything else) starts dark,
  // the mock's primary presentation, rather than whatever the browser
  // defaulted to.
  await page.evaluate(() => localStorage.setItem('dp-theme', 'dark'))

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/new$/)
  await page.getByLabel('Project name').fill('Detail Redesign QA')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/^dp_test_/)).toBeVisible()
  await page.getByRole('button', { name: 'Continue to dashboard' }).click()
  await expect(page).toHaveURL(/\/[^/]+$/)

  await page.getByRole('link', { name: 'Domains', exact: true }).click()
  await expect(page).toHaveURL(/\/domains$/)

  // --- Domain 1: pending-then-verified.test (stays pending ~45s) ---
  await page.getByRole('button', { name: 'Add domain' }).click()
  await page.getByLabel('Domain').fill('pending-then-verified.test')
  await page.getByRole('button', { name: 'Add domain' }).click()
  await expect(page).toHaveURL(/\/domains\/[^/]+$/)
  const pendingUrl = page.url()

  await expect(page.getByText('Propagating', { exact: true })).toBeVisible()
  await expect(page.getByText('Record added')).toBeVisible()
  await expect(page.getByText('Send this to whoever manages DNS')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '01-pending-dark-wide.png'),
    fullPage: true,
  })

  // Copy verification link — now a low-emphasis Actions menu item, not its
  // own header button.
  const verificationUrl = await page.locator('input[readonly]').inputValue()
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Copy verification link' }).click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(verificationUrl)
  await page.screenshot({
    path: path.join(ARTIFACTS, '02-copy-link-copied.png'),
  })

  // --- Laptop-width collapse check on the same page ---
  await page.setViewportSize({ width: 900, height: 900 })
  await page.screenshot({
    path: path.join(ARTIFACTS, '03-pending-laptop-collapsed.png'),
    fullPage: true,
  })

  // --- Phone width — one primary button + one low-emphasis Actions menu
  // button, both fully labeled (no icon-only collapse needed with only
  // two header actions left). ---
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Check now' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '03b-pending-phone-icon-collapse.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 900 })

  // --- Light theme ---
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'View light' }).click()
  await page.screenshot({
    path: path.join(ARTIFACTS, '04-pending-light-wide.png'),
    fullPage: true,
  })
  // The theme menu item stays open after toggling (so it can be flipped
  // again without reopening) — no need to re-click the trigger.
  await page.getByRole('menuitem', { name: 'View dark' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem', { name: 'View dark' })).toHaveCount(0)

  // --- Delete dialog (domain), cancel it ---
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete domain' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Delete pending-then-verified.test?' }),
  ).toBeVisible()
  await page.getByRole('dialog').screenshot({
    path: path.join(ARTIFACTS, '05b-delete-dialog-cropped.png'),
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, '05-delete-dialog-open.png'),
  })
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // --- Domain 2: wrong-value.test — a `wrong_value` outcome hard-fails a
  // pending domain immediately (core's `eventForCheckOutcome`: a
  // syntactically valid but incorrect record is actionable, not "not there
  // yet"), so one "Check now" click both produces the full expected/found
  // diff *and* reaches the terminal `failed` state in the same click — no
  // need to wait out a 72h challenge expiry or fake it.
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Domains', exact: true }).click()
  await page.getByRole('button', { name: 'Add domain' }).click()
  await page.getByLabel('Domain').fill('wrong-value.test')
  await page.getByRole('button', { name: 'Add domain' }).click()
  await expect(page).toHaveURL(/\/domains\/[^/]+$/)

  // A delay on the verify request gives the "Check now" button's loading
  // state a window to be screenshotted — proving the spinner *replaces*
  // the RefreshCw icon rather than rendering alongside it.
  await page.route('**/domains/*/verify', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return route.fallback()
  })
  await page.getByRole('button', { name: 'Check now' }).click()
  await expect(page.getByRole('button', { name: 'Check now' })).toBeDisabled()
  await page.screenshot({
    path: path.join(ARTIFACTS, '05c-check-now-spinner-only.png'),
  })
  await page.unroute('**/domains/*/verify')
  await expect(page.getByText('Mismatch')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Needs attention')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '06-failed-full-diff.png'),
    fullPage: true,
  })

  // Reload to clear the in-session check state, confirming the cold-load
  // honest-reduced rendering (the dashboard API doesn't persist/return a
  // last-check result, so a fresh load has no found-data to show).
  await page.reload()
  await expect(page.getByText('Needs attention')).toBeVisible()
  await expect(page.getByText('What we found').first()).toBeVisible()
  await expect(page.getByText('Mismatch')).toHaveCount(0)
  await page.screenshot({
    path: path.join(ARTIFACTS, '07-failed-cold-load-reduced.png'),
    fullPage: true,
  })

  // Same icon/spinner-swap check as "Check now" above, for the "Check
  // again" button in the "What we found" card — it shares the same
  // `handleVerify`/`loading` wiring, so the same double-render bug would
  // hit it too if the primitive fix ever regressed.
  await page.route('**/domains/*/verify', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return route.fallback()
  })
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page.getByRole('button', { name: 'Check again' })).toBeDisabled()
  await page.screenshot({
    path: path.join(ARTIFACTS, '07b-check-again-spinner-only.png'),
  })
  await page.unroute('**/domains/*/verify')
  // Specifically the "What we found" card's own Mismatch badge — proves
  // the retry actually repopulated a fresh expected/found diff, not just
  // that the (already-present, minutes-old) vlog history still says so.
  await expect(page.getByText('Mismatch')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('wrongwrongwrong')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '08-failed-check-again-full-diff.png'),
    fullPage: true,
  })

  // --- Delete dialog failure path: a mocked 500 on the DELETE request must
  // return the dialog to an actionable state (spinner gone, error shown,
  // Confirm re-enabled) rather than leaving it stuck loading or silently
  // closing as if the delete had succeeded.
  await page.route('**/dashboard/projects/*/domains/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'Simulated failure for e2e verification.',
        },
      }),
    })
  })
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete domain' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(
    page.getByRole('button', { name: 'Confirm delete' }),
  ).toBeDisabled()
  await expect(
    page.getByText('Simulated failure for e2e verification.'),
  ).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirm delete' }),
  ).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  await page.screenshot({
    path: path.join(ARTIFACTS, '08b-delete-failure-actionable.png'),
  })
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.unroute('**/dashboard/projects/*/domains/*')

  // --- Webhook delete dialog ---
  await page.goto(page.url().replace(/\/domains\/.*/, '/webhooks'))
  await page
    .getByRole('main')
    .getByRole('button', { name: '+ Add endpoint' })
    .click()
  await page.getByLabel('Endpoint URL').fill('https://example.com/hook')
  await page.getByRole('button', { name: 'Add endpoint' }).click()
  await expect(page.getByText('Save this now.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button').filter({ hasText: 'example.com' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '09-webhook-delete-dialog-open.png'),
  })
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // --- Back to domain 1: wait out its 45s propagation window, confirm the
  // auto-check schedule (not a manual click) flips it to verified. Scoped
  // to the header's status badge specifically — the stepper's 4th step is
  // *always* labeled "Verified", reached or not, so an unscoped match would
  // pass immediately regardless of actual status.
  await page.goto(pendingUrl)
  await expect(
    page.getByRole('banner').getByText('Verified', { exact: true }),
  ).toBeVisible({ timeout: 60_000 })
  await page.screenshot({
    path: path.join(ARTIFACTS, '10-verified-auto-checked.png'),
    fullPage: true,
  })

  // --- Real delete, end to end — an artificial delay on the DELETE
  // request gives the spinner-holds-until-navigation behavior a window to
  // actually be observed instead of the redirect outrunning the assertion.
  await page.route('**/dashboard/projects/*/domains/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    await new Promise((resolve) => setTimeout(resolve, 500))
    return route.fallback()
  })
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete domain' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(
    page.getByRole('button', { name: 'Confirm delete' }),
  ).toBeDisabled()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '11-delete-spinner-holds.png'),
  })
  await expect(page).toHaveURL(/\/domains$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
