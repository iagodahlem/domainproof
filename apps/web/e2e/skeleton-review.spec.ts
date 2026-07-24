import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { clerk } from '@clerk/testing/playwright'
import { expect, test, type Page } from '@playwright/test'
import { STATE_FILE } from './global-setup'

/**
 * Manual visual-verification pass for the #105 loading-state rework — not
 * part of the regular suite (run explicitly: `playwright test
 * e2e/skeleton-review.spec.ts`, never alongside another spec in the same
 * run, since each consumes the same single-use sign-in ticket).
 * Screenshots land in `.claude/artifacts/skeleton-review/` (gitignored).
 *
 * Every dashboard route's primary query is delayed on the *first* client-
 * side transition into it, so its `loading.tsx` skeleton stays on screen
 * long enough to screenshot before the (delayed) real data arrives — a
 * *second* visit to the same query reads from the now-warm cache and
 * never suspends again, so each route is visited via delayed transition
 * exactly once. `page.route` only sees the browser's own fetches, so this
 * only works for client-side transitions; a hard reload's primary query is
 * fetched server-side, invisible to it — the cold-load check near the
 * bottom throttles the whole connection via CDP instead, to prove the
 * actual point of the architecture change: fast TTFB (the skeleton itself,
 * not a blank tab) followed by a fill-in, never a server-side wait.
 *
 * Route patterns below deliberately omit the `dashboard/` segment (e.g.
 * `**\/projects/*\/domains*`, not `**\/dashboard/projects/*\/domains*`) —
 * a glob containing that literal segment silently never matches here
 * (confirmed by direct comparison; root cause not chased further), so the
 * shorter pattern is the one that actually works.
 */
const ARTIFACTS = path.join(process.cwd(), '.claude/artifacts/skeleton-review')
const DELAY_MS = 1500

test.setTimeout(180_000)

async function delay(page: Page, pattern: string) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    return route.fallback()
  })
}

/** Next's hidden route-announcer briefly holds the *previous* page's h1 text after a client-side navigation — scoping to `main` avoids matching it instead of real content. */
function main(page: Page) {
  return page.getByRole('main')
}

/** A React transition's Suspense-fallback swap paints on the next frame or two, after `click()` itself has already resolved — a short settle avoids screenshotting the pre-click frame by accident. */
async function settle(page: Page) {
  await page.waitForTimeout(300)
}

test('dashboard skeletons match their loaded routes', async ({
  page,
  context,
}) => {
  const { ticket } = JSON.parse(await readFile(STATE_FILE, 'utf-8')) as {
    ticket: string
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await clerk.signIn({ page, signInParams: { strategy: 'ticket', ticket } })
  await page.evaluate(() => localStorage.setItem('dp-theme', 'dark'))

  // Register the overview/domains/webhooks delays *before* the `/new` flow's
  // own redirect, so the very first landing on Overview is itself delayed —
  // no separate probe visit that would warm the cache first.
  await delay(page, '**/projects/*/domains*')
  await delay(page, '**/projects/*/webhooks*')

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/new$/)
  await page.getByLabel('Project name').fill('Skeleton Review')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/^dp_test_/)).toBeVisible()
  await page.getByRole('button', { name: 'Continue to dashboard' }).click()
  await settle(page)
  await page.screenshot({
    path: path.join(ARTIFACTS, '01a-overview-fresh-skeleton.png'),
    fullPage: true,
  })
  await expect(main(page).getByText('Get started')).toBeVisible({
    timeout: 10_000,
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, '01b-overview-fresh-loaded.png'),
    fullPage: true,
  })
  await page.unroute('**/projects/*/domains*')
  await page.unroute('**/projects/*/webhooks*')
  const projectUrl = page.url()

  // --- Domains list, empty — first visit to this query, still delayed
  // from the setup above (never unrouted for `domains*` until now). ---
  await delay(page, '**/projects/*/domains*')
  await page.getByRole('link', { name: 'Domains', exact: true }).click()
  await settle(page)
  await page.screenshot({
    path: path.join(ARTIFACTS, '02a-domains-empty-skeleton.png'),
    fullPage: true,
  })
  // Not `getByRole('button', { name: 'Add domain' })` — the skeleton
  // registers that same (disabled) button in the topbar too, so it's
  // already visible above and would resolve this instantly.
  await expect(main(page).getByText('No domains yet')).toBeVisible({
    timeout: 10_000,
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, '02b-domains-empty-loaded.png'),
    fullPage: true,
  })
  await page.unroute('**/projects/*/domains*')

  // Claim the sandbox domain — feeds the populated domains-list loaded
  // shot, the domain-detail skeleton, and the overview's populated state
  // below.
  await page.getByRole('button', { name: 'Add domain' }).click()
  const domainDrawer = page.getByRole('dialog')
  await page
    .getByLabel('Domain', { exact: true })
    .fill('pending-then-verified.test')
  // Unlike the other routes here, this page's data never shows up as a
  // separate browser-visible fetch at all — it arrives fully resolved in
  // the RSC navigation response itself (the server's own `prefetchQuery`
  // resolves fast enough on this local stack to embed resolved data
  // rather than a still-pending one, and no client-side query ever needs
  // to independently refetch). Delaying a *request's start* via
  // `page.route` can't create a gap once that's true — the whole
  // response, skeleton chunk and resolved-data chunk together, still
  // arrives in one fast burst the instant the delay releases it. Only a
  // genuine byte-level transfer throttle (CDP) spreads that burst out
  // enough to catch a frame in between, same mechanism as the cold-load
  // check further down — applied here to the main `page` directly rather
  // than a fresh tab, then reset once this step is done.
  const detailClient = await page.context().newCDPSession(page)
  await detailClient.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (600 * 1024) / 8,
    uploadThroughput: (300 * 1024) / 8,
    latency: 100,
  })
  await domainDrawer.getByRole('button', { name: 'Add domain' }).click()
  await expect(page).toHaveURL(/\/domains\/[^/]+$/)
  // `page.url()` (what `toHaveURL` checks) can reflect the new route
  // before its content has actually painted — the back-chevron is
  // registered by both `DomainDetailSkeleton` and the real page (unlike
  // `.animate-pulse`, which the still-visible *previous* page might also
  // have), so waiting for it confirms we've actually left the list view.
  await expect(page.getByRole('link', { name: 'Back to domains' })).toBeVisible(
    { timeout: 15_000 },
  )
  await page.screenshot({
    path: path.join(ARTIFACTS, '03a-domain-detail-skeleton.png'),
    fullPage: true,
  })
  await expect(main(page).getByText('Ownership record')).toBeVisible({
    timeout: 15_000,
  })
  await detailClient.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, '03b-domain-detail-loaded.png'),
    fullPage: true,
  })

  // --- Domains list, populated (a warm revisit — no skeleton to catch,
  // React Query serves the cached-then-invalidated list without
  // suspending; this is just the loaded-structure comparison). ---
  await page.getByRole('link', { name: 'Domains', exact: true }).click()
  await expect(main(page).getByText('pending-then-verified.test')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '04-domains-populated-loaded.png'),
    fullPage: true,
  })

  // --- Webhooks, empty — first visit to this query ---
  await delay(page, '**/projects/*/webhooks*')
  await page.getByRole('link', { name: 'Webhooks', exact: true }).click()
  await settle(page)
  await page.screenshot({
    path: path.join(ARTIFACTS, '05a-webhooks-empty-skeleton.png'),
    fullPage: true,
  })
  await expect(main(page).getByText('No endpoints yet')).toBeVisible({
    timeout: 10_000,
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, '05b-webhooks-empty-loaded.png'),
    fullPage: true,
  })
  await page.unroute('**/projects/*/webhooks*')

  await page
    .getByRole('main')
    .getByRole('button', { name: '+ Add endpoint' })
    .click()
  const endpointDrawer = page.getByRole('dialog')
  await page.getByLabel('Endpoint URL').fill('https://example.com/hook')
  await endpointDrawer.getByRole('button', { name: 'Add endpoint' }).click()
  await expect(page.getByText('Save this now.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(main(page).getByText('example.com')).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '06-webhooks-populated-loaded.png'),
    fullPage: true,
  })

  // --- Events — first visit ---
  await delay(page, '**/projects/*/events*')
  await page.getByRole('link', { name: 'Events', exact: true }).click()
  await settle(page)
  await page.screenshot({
    path: path.join(ARTIFACTS, '07a-events-skeleton.png'),
    fullPage: true,
  })
  await expect(main(page).getByText('domain.claimed')).toBeVisible({
    timeout: 10_000,
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, '07b-events-loaded.png'),
    fullPage: true,
  })
  await page.unroute('**/projects/*/events*')

  // --- Settings — first visit ---
  await delay(page, '**/projects/*/keys*')
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await settle(page)
  await page.screenshot({
    path: path.join(ARTIFACTS, '08a-settings-skeleton.png'),
    fullPage: true,
  })
  await expect(main(page).getByText('API keys')).toBeVisible({
    timeout: 10_000,
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, '08b-settings-loaded.png'),
    fullPage: true,
  })
  await page.unroute('**/projects/*/keys*')

  // --- Overview, populated (warm revisit — loaded-structure comparison
  // only, same reasoning as the domains-populated shot above). ---
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(
    main(page).getByRole('heading', { name: 'Status' }),
  ).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '09-overview-populated-loaded.png'),
    fullPage: true,
  })

  // --- Account dropdown: Docs link, theme row, sign out — dark theme ---
  await page.getByRole('button', { name: /account menu/i }).click()
  await expect(page.getByRole('menuitem', { name: 'Docs' })).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '10a-account-dropdown-dark.png'),
  })

  // --- Same dropdown, light theme — selecting a theme tab must not close
  // the menu (see UserMenu's `ThemeFooterRow` doc comment), so it's still
  // open here with no need to reopen it. ---
  await page.getByRole('tab', { name: 'Light' }).click()
  await expect(page.getByRole('menuitem', { name: 'Docs' })).toBeVisible()
  await page.screenshot({
    path: path.join(ARTIFACTS, '10b-account-dropdown-light.png'),
  })

  // Docs link actually navigates — same tab, a plain internal `<Link>`.
  await page.getByRole('menuitem', { name: 'Docs' }).click()
  await expect(page).toHaveURL(/\/docs/, { timeout: 10_000 })
  await page.screenshot({
    path: path.join(ARTIFACTS, '11-docs-link-navigated.png'),
    fullPage: true,
  })

  // --- Cold load: a hard reload's primary query is fetched server-side,
  // invisible to `page.route` — throttle the whole connection via CDP
  // instead, in a fresh tab (fresh QueryClient, no warm cache to skip the
  // suspense on), so the streamed skeleton chunk and the later data chunk
  // arrive far enough apart to both be observable. ---
  const cold = await context.newPage()
  const client = await cold.context().newCDPSession(cold)
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (200 * 1024) / 8,
    latency: 80,
  })
  await cold.goto(projectUrl, { waitUntil: 'commit' })
  await expect(cold.locator('.animate-pulse').first()).toBeVisible({
    timeout: 20_000,
  })
  await cold.screenshot({
    path: path.join(ARTIFACTS, '12a-cold-load-skeleton.png'),
    fullPage: true,
  })
  await expect(cold.locator('.animate-pulse')).toHaveCount(0, {
    timeout: 30_000,
  })
  await cold.screenshot({
    path: path.join(ARTIFACTS, '12b-cold-load-filled-in.png'),
    fullPage: true,
  })
})
