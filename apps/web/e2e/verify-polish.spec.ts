import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { clerk } from '@clerk/testing/playwright'
import { expect, test } from '@playwright/test'
import { STATE_FILE } from './global-setup'

/**
 * One-off verification pass for the onboarding-polish branch — not part of
 * the regular suite. Screenshots land in `.claude/artifacts/` (gitignored).
 */
const ARTIFACTS = path.join(process.cwd(), '.claude/artifacts')

test.setTimeout(240_000)

test('onboarding polish: sandbox timing, checklist, drawer hint, skeleton', async ({
  page,
}) => {
  const { ticket } = JSON.parse(await readFile(STATE_FILE, 'utf-8')) as {
    ticket: string
  }

  await page.goto('/')
  await clerk.signIn({ page, signInParams: { strategy: 'ticket', ticket } })

  await page.goto('/new')
  await page.getByLabel('Project name').fill('Polish Verify Project')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText(/^dp_test_/)).toBeVisible()
  await page.getByRole('button', { name: 'Continue to dashboard' }).click()
  // `/\/[^/]+$/` alone would also match the intermediate `/new` — wait for
  // the Overview heading so the URL has actually settled on the project
  // path before capturing it.
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page).toHaveURL(/\/[^/]+$/)
  const projectPath = new URL(page.url()).pathname

  // --- Item 2: checklist stays open once the domain verifies ---
  await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible()

  // --- Item 1: claim the onboarding sandbox domain, time first-check latency ---
  const claimStart = Date.now()
  await page.getByRole('button', { name: 'Run against sandbox' }).click()
  await expect(page.getByText('Propagating', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  const pendingAt = Date.now()
  console.log(
    `[timing] claim -> propagating shown: ${pendingAt - claimStart}ms`,
  )

  await expect(page.getByText('Verified', { exact: true }).first()).toBeVisible(
    {
      timeout: 40_000,
    },
  )
  const verifiedAt = Date.now()
  console.log(
    `[timing] claim -> verified shown: ${verifiedAt - claimStart}ms (sandbox propagation is seeded at 12s)`,
  )

  // The completed checklist must still be the full card, not the collapsed
  // strip — wait for the server-derived progress to catch up (via
  // `useRefreshOnVerified`'s `router.refresh()`) before capturing, since the
  // walkthrough's own "Verified" badge above is client-side state that lands
  // first.
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Setup: \d of 3 done$/ }),
  ).toHaveCount(0)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'checklist-completed-still-open.png'),
    fullPage: true,
  })

  // --- Item 3: sandbox-domain hint in the add-domain drawer (TEST mode) ---
  await page.getByRole('link', { name: 'Domains', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${projectPath}/domains$`))
  await page.getByRole('button', { name: 'Add domain' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Sandbox domains verify instantly')).toBeVisible()
  const sandboxDocsLink = page.getByRole('link', { name: 'Full table' })
  await expect(sandboxDocsLink).toBeVisible()
  await expect(sandboxDocsLink).toHaveAttribute('href', '/docs/sandbox')
  // The drawer's own slide-in animation is still mid-flight the instant its
  // content becomes visible/queryable — a beat lets it settle so the
  // screenshot shows the drawer at its full resting width, not a
  // still-translating sliver.
  await page.waitForTimeout(400)
  await page.screenshot({
    path: path.join(ARTIFACTS, 'add-domain-drawer-sandbox-hint.png'),
  })
  await page.keyboard.press('Escape')

  // --- Item 5: domain detail skeleton vs loaded page ---
  // This page's data never shows up as a separate browser-visible fetch —
  // it arrives fully resolved in the RSC navigation response itself (the
  // server's own `prefetchQuery` resolves fast enough locally to embed
  // resolved data rather than a still-pending one). Delaying a *request's
  // start* via `page.route` can't create a gap once that's true — only a
  // genuine byte-level transfer throttle (CDP) spreads the response out
  // enough to catch `loading.tsx` mid-flight. Same technique as
  // `skeleton-review.spec.ts`'s own domain-detail capture.
  const detailClient = await page.context().newCDPSession(page)
  await detailClient.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (600 * 1024) / 8,
    uploadThroughput: (300 * 1024) / 8,
    latency: 100,
  })
  await page
    .getByRole('button')
    .filter({ hasText: 'pending-then-verified.test' })
    .click()
  await expect(page).toHaveURL(/\/domains\/[^/]+$/)
  // `page.url()` (what `toHaveURL` checks) can reflect the new route before
  // its content has actually painted — the back-chevron is registered by
  // both `DomainDetailSkeleton` and the real page, unlike `.animate-pulse`
  // (which the still-visible *previous* page might also have), so waiting
  // for it confirms we've actually left the list view.
  await expect(page.getByRole('link', { name: 'Back to domains' })).toBeVisible(
    { timeout: 15_000 },
  )
  await page.screenshot({
    path: path.join(ARTIFACTS, 'domain-detail-skeleton.png'),
    fullPage: true,
  })
  await expect(page.getByText('checked so far')).toBeVisible({
    timeout: 15_000,
  })
  await detailClient.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  })
  await page.screenshot({
    path: path.join(ARTIFACTS, 'domain-detail-loaded.png'),
    fullPage: true,
  })
})

// --- Item 4: demo widget renders already bound to the claimed domain ---
test('demo: embedded widget binds to the domain claimed at scan time', async ({
  page,
}) => {
  // `@domainproof/react` has no local-dev base-URL wiring in the demo app
  // (pre-existing gap, not part of this branch — neither `verify-gate.tsx`
  // nor `sitegrade-app.tsx` wraps the widget in a `DomainProofProvider`),
  // so it always falls back to its hardcoded production default. Redirect
  // just for this capture so the embedded widget's own fetches land on the
  // local api instead of the real one.
  await page.route('https://frontend.api.domainproof.dev/**', async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `http://localhost:5401${url.pathname}${url.search}`,
    })
    await route.fulfill({ response })
  })

  await page.goto('/demo')
  await page.getByLabel('Domain to scan').fill('github.com')
  await page.getByRole('button', { name: 'Scan for free' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Own github.com? Verify to unlock the full report.',
    }),
  ).toBeVisible({ timeout: 15_000 })

  // The widget must show the bound claim's live status directly — no
  // "Verify a domain" claim input — and still offer a way to verify a
  // different domain than the one just scanned.
  await expect(
    page.getByText('Live status for the domain we just claimed above'),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('Domain', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Verify a different domain instead' }),
  ).toBeVisible()

  await page.screenshot({
    path: path.join(ARTIFACTS, 'demo-widget-bound.png'),
    fullPage: true,
  })
})

// --- Round 2: refresh restores the report; re-entering the same domain
// still resolves to the existing claim instead of failing ---
test('demo: report survives a refresh and re-entering the same domain', async ({
  page,
}) => {
  const domain = 'stripe.com'
  const gateHeading = page.getByRole('heading', {
    name: `Own ${domain}? Verify to unlock the full report.`,
  })
  const boundStatusText = page.getByText(
    'Live status for the domain we just claimed above',
  )

  await page.goto('/demo')
  await page.getByLabel('Domain to scan').fill(domain)
  await page.getByRole('button', { name: 'Scan for free' }).click()
  await expect(gateHeading).toBeVisible({ timeout: 15_000 })
  await expect(boundStatusText).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\?scan=/)

  // --- The report is client state only — a refresh must restore it from
  // the URL's own `?scan=` param rather than losing it back to the form.
  await page.reload()
  await expect(gateHeading).toBeVisible({ timeout: 15_000 })
  await expect(boundStatusText).toBeVisible({ timeout: 15_000 })
  await page.screenshot({
    path: path.join(ARTIFACTS, 'demo-report-restored-after-refresh.png'),
    fullPage: true,
  })

  // --- Re-entering the same domain from a clean URL (the owner's exact
  // repro) must still bind to the widget, not fail on a domain this same
  // project already claimed.
  await page.goto('/demo')
  await page.getByLabel('Domain to scan').fill(domain)
  await page.getByRole('button', { name: 'Scan for free' }).click()
  await expect(gateHeading).toBeVisible({ timeout: 15_000 })
  await expect(boundStatusText).toBeVisible({ timeout: 15_000 })
})

// --- Round 3: the owner deletes the claimed domain (e.g. from the
// dashboard) after the demo already claimed it — the stored claim must
// never be served as-is once it stops resolving.
test('demo: a claim whose domain got deleted elsewhere self-heals into a fresh one', async ({
  page,
}) => {
  const apiKey = process.env.DEMO_DOMAINPROOF_API_KEY
  test.skip(
    !apiKey,
    'DEMO_DOMAINPROOF_API_KEY not set — see apps/web/.env.example',
  )
  const apiBaseUrl =
    process.env.DEMO_DOMAINPROOF_BASE_URL ?? 'http://localhost:3001'

  const domain = 'wikipedia.org'
  const gateHeading = page.getByRole('heading', {
    name: `Own ${domain}? Verify to unlock the full report.`,
  })
  const boundStatusText = page.getByText(
    'Live status for the domain we just claimed above',
  )

  // `@domainproof/react` has no local-dev base-URL wiring in the demo app
  // (see the "Item 4" test above), so it always falls back to its
  // hardcoded production default — redirect just for this test so the
  // widget's own fetches land on the local api instead of the real one.
  await page.route('https://frontend.api.domainproof.dev/**', async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({
      url: `${apiBaseUrl}${url.pathname}${url.search}`,
    })
    await route.fulfill({ response })
  })

  await page.goto('/demo')
  await page.getByLabel('Domain to scan').fill(domain)
  await page.getByRole('button', { name: 'Scan for free' }).click()
  await expect(gateHeading).toBeVisible({ timeout: 15_000 })
  await expect(boundStatusText).toBeVisible({ timeout: 15_000 })

  // Delete the domain out from under the claim, the same way a project
  // owner would from the dashboard's domain list.
  const listResponse = await page.request.get(
    `${apiBaseUrl}/v1/domains?domain=${encodeURIComponent(domain)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  )
  const { domains } = (await listResponse.json()) as {
    domains: { id: string }[]
  }
  const claimedDomain = domains[0]
  expect(claimedDomain).toBeTruthy()
  await page.request.delete(`${apiBaseUrl}/v1/domains/${claimedDomain?.id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  // The demo's own status endpoint (it shares the browser's visitor
  // cookie) must never keep surfacing the dead claim — either this poll or
  // the page's own background one (every 5s, see sitegrade-app.tsx) has to
  // reclaim the domain fresh. Racing the page's own poll means the first
  // request here might already see the healed state rather than catch the
  // reclaim itself, so poll until it's unambiguously healthy rather than
  // asserting on a single response.
  await expect
    .poll(
      async () => {
        const res = await page.request.get('/demo/api/status')
        const body = (await res.json()) as { claimed?: boolean }
        return res.ok() && body.claimed === true
      },
      { timeout: 15_000 },
    )
    .toBe(true)

  // The embedded widget must pick up the fresh claim on its own next poll
  // rather than getting stuck showing "Verification not found" for a claim
  // that no longer exists.
  await expect(
    page.getByRole('button', { name: /^Check now$|^Checking…$/ }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Verification not found')).toHaveCount(0)
})
