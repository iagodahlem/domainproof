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
  await page.evaluate(() => localStorage.setItem('dp_theme', 'dark'))

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

  // Copy verification link
  await page.getByRole('button', { name: 'Copy verification link' }).click()
  await expect(page.getByText('Copied')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '02-copy-link-copied.png'),
  })

  // --- Laptop-width collapse check on the same page ---
  await page.setViewportSize({ width: 900, height: 900 })
  await page.screenshot({
    path: path.join(ARTIFACTS, '03-pending-laptop-collapsed.png'),
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
  await page.getByRole('button', { name: 'More actions' }).click()
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

  await page.getByRole('button', { name: 'Check now' }).click()
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

  await page.getByRole('button', { name: 'Check again' }).click()
  // Specifically the "What we found" card's own Mismatch badge — proves
  // the retry actually repopulated a fresh expected/found diff, not just
  // that the (already-present, minutes-old) vlog history still says so.
  await expect(page.getByText('Mismatch')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('wrongwrongwrong')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '08-failed-check-again-full-diff.png'),
    fullPage: true,
  })

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

  // --- Real delete, end to end ---
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete domain' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page).toHaveURL(/\/domains$/)
})
