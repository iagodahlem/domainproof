import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { clerk } from '@clerk/testing/playwright'
import { expect, test } from '@playwright/test'
import { STATE_FILE } from './global-setup'

/**
 * Manual visual-verification pass for the add-domain/add-webhook drawer
 * conversion — not part of the regular suite (run explicitly:
 * `playwright test e2e/add-drawers.spec.ts`, never alongside
 * `signup-flow.spec.ts`/`domain-detail.spec.ts` in the same run, since all
 * three would try to consume the same single-use sign-in ticket).
 * Screenshots land in `.claude/artifacts/` (gitignored).
 */
const ARTIFACTS = path.join(process.cwd(), '.claude/artifacts')

/** Lets the drawer's open/close slide animation settle before a screenshot. */
const ANIMATION_SETTLE_MS = 350

test.setTimeout(120_000)

test('add-domain and add-webhook drawers — desktop, mobile sheet, validation, both themes', async ({
  page,
}) => {
  const { ticket } = JSON.parse(await readFile(STATE_FILE, 'utf-8')) as {
    ticket: string
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await clerk.signIn({ page, signInParams: { strategy: 'ticket', ticket } })
  await page.evaluate(() => localStorage.setItem('dp-theme', 'dark'))

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/new$/)
  await page.getByLabel('Project name').fill('Add Drawers QA')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/^dp_test_/)).toBeVisible()
  await page.getByRole('button', { name: 'Continue to dashboard' }).click()
  await expect(page).toHaveURL(/\/[^/]+$/)

  // ================== Domains — desktop, dark ==================
  await page.getByRole('link', { name: 'Domains', exact: true }).click()
  await expect(page).toHaveURL(/\/domains$/)

  await page.getByRole('button', { name: 'Add domain' }).click()
  const domainDrawer = page.getByRole('dialog')
  await expect(domainDrawer).toBeVisible()
  await expect(domainDrawer.getByText('Add a domain')).toBeVisible()
  // The trigger stays mounted behind the drawer — it never conditionally
  // unmounts or relabels (Radix marks it `aria-hidden` while the dialog is
  // open, same as the rest of the background, so a role-based lookup
  // correctly stops matching it; a raw DOM lookup still finds it).
  await expect(page.locator('button', { hasText: 'Add domain' })).toHaveCount(2)
  await page.waitForTimeout(ANIMATION_SETTLE_MS)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-01-add-domain-open-dark.png'),
  })

  // Validation error keeps the drawer open.
  await domainDrawer.getByRole('button', { name: 'Add domain' }).click()
  await expect(domainDrawer.getByText('Domain is required.')).toBeVisible()
  await expect(domainDrawer).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-02-add-domain-validation-error.png'),
  })

  // Escape closes it, list still there behind.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Light theme.
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'View light' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Add domain' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(ANIMATION_SETTLE_MS)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-03-add-domain-open-light.png'),
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Back to dark for the rest of the pass.
  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('menuitem', { name: 'View dark' }).click()
  await page.keyboard.press('Escape')

  // Mobile bottom sheet — grab bar, no corner close X.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Add domain' }).click()
  const mobileDomainDrawer = page.getByRole('dialog')
  await expect(mobileDomainDrawer).toBeVisible()
  await expect(
    mobileDomainDrawer.getByRole('button', { name: 'Close' }),
  ).toBeHidden()
  await page.waitForTimeout(ANIMATION_SETTLE_MS)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-04-add-domain-mobile-sheet.png'),
  })

  // Fill + submit end to end on mobile — drawer's success path navigates
  // straight to the new domain's detail page (unchanged from before the
  // drawer conversion — there's no intermediate "row appears" moment to
  // capture for this flow).
  await page.getByLabel('Domain', { exact: true }).fill('verified.test')
  await mobileDomainDrawer.getByRole('button', { name: 'Add domain' }).click()
  await expect(page).toHaveURL(/\/domains\/[^/]+$/)
  await page.setViewportSize({ width: 1440, height: 900 })

  // ================== Webhooks — desktop, dark ==================
  await page.goto(page.url().replace(/\/domains\/.*/, '/webhooks'))
  await page.getByRole('button', { name: '+ Add endpoint' }).click()
  const endpointDrawer = page.getByRole('dialog')
  await expect(endpointDrawer).toBeVisible()
  await expect(endpointDrawer.getByText('Add an endpoint')).toBeVisible()
  // The trigger stays mounted behind the drawer here too (aria-hidden
  // while open, same as the domains page — see the comment above). Two
  // matches, not one: the topbar trigger plus the empty state's own CTA
  // (endpoints list is still empty at this point).
  await expect(
    page.locator('button', { hasText: '+ Add endpoint' }),
  ).toHaveCount(2)
  await page.waitForTimeout(ANIMATION_SETTLE_MS)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-05-add-endpoint-open-dark.png'),
  })

  // Validation error keeps the drawer open.
  await endpointDrawer.getByRole('button', { name: 'Add endpoint' }).click()
  await expect(
    endpointDrawer.getByText('Endpoint URL is required.'),
  ).toBeVisible()
  await expect(endpointDrawer).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-06-add-endpoint-validation-error.png'),
  })

  // Fill + submit — drawer closes, secret reveal + new row appear.
  await page.getByLabel('Endpoint URL').fill('https://example.com/hook')
  await endpointDrawer.getByRole('button', { name: 'Add endpoint' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Save this now.', { exact: true })).toBeVisible()
  // Two matches: the secret-reveal card's own sub-label plus the new row
  // in the table below it.
  await expect(page.getByText('https://example.com/hook')).toHaveCount(2)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-07-add-endpoint-closed-row-appears.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Done' }).click()

  // Mobile bottom sheet — grab bar, no corner close X.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '+ Add endpoint' }).click()
  const mobileEndpointDrawer = page.getByRole('dialog')
  await expect(mobileEndpointDrawer).toBeVisible()
  await expect(
    mobileEndpointDrawer.getByRole('button', { name: 'Close' }),
  ).toBeHidden()
  await page.waitForTimeout(ANIMATION_SETTLE_MS)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'drawer-08-add-endpoint-mobile-sheet.png'),
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
