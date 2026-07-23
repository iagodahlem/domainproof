# @domainproof/react

Embeddable React hooks and a drop-in `<DomainVerification />` component for
[DomainProof](https://domainproof.dev) domain-ownership verification —
claim a domain, show the DNS record to publish, and poll for verification,
all from a component in your own frontend.

Talks directly to DomainProof's Frontend API (`/frontend/*`) over native
`fetch` — no runtime dependency on `@domainproof/sdk` (that's the
server-side client) or any DomainProof workspace package. Ships both ESM
and CommonJS builds. Peer-depends on `react >=18`.

## Install

```bash
npm install @domainproof/react
```

## Quickstart

A drop-in component needs a short-lived **session token**, minted
server-side with your project's api key — never expose the api key itself
to the browser.

1. From your backend, mint a session with `@domainproof/sdk`:

   ```ts
   import { DomainProof } from '@domainproof/sdk'

   const domainproof = new DomainProof({ apiKey: process.env.DOMAINPROOF_API_KEY! })
   const { data, error } = await domainproof.componentSessions.create()
   if (error) throw error

   // Hand data.sessionToken to your frontend — it's single-use and expires in an hour.
   ```

2. Pass `sessionToken` to the component:

   ```tsx
   'use client'

   import { DomainVerification } from '@domainproof/react'

   export function ConnectDomain({ sessionToken }: { sessionToken: string }) {
     return (
       <DomainVerification
         sessionToken={sessionToken}
         onVerified={(verification) => console.log(`${verification.domain} verified`)}
       />
     )
   }
   ```

That's it — the component handles claiming the domain, showing the TXT
record (with copy buttons), an auto-checking status indicator, and the
verified/failed outcome states.

By default it talks to the production Frontend API
(`https://frontend.api.domainproof.dev`). Point it at a local API during
development, either per-component (`<DomainVerification baseUrl="http://localhost:3001" ... />`)
or for a whole tree with `DomainProofProvider`:

```tsx
import { DomainProofProvider } from '@domainproof/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DomainProofProvider baseUrl="http://localhost:3001">
      {children}
    </DomainProofProvider>
  )
}
```

`DomainProofProvider` is optional — every hook falls back to production on
its own.

## Headless hooks

Compose these directly instead of `<DomainVerification />` for full control
over markup and styling.

### `useClaimDomain(sessionToken, options?)`

Spends a component session to claim a domain —
`POST /frontend/component-sessions/:sessionToken/claim`.

| Field    | Type                                       | Notes                                                              |
| -------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `status` | `'idle' \| 'claiming' \| 'success' \| 'error'` |                                                                       |
| `data`   | `ClaimResult \| null`                       | Set on success. `data.frontendToken` feeds `useVerification` below.  |
| `error`  | `DomainProofError \| null`                  | `{ kind: 'http', status, code, message }` or `{ kind: 'network', message }` |
| `claim`  | `(domain: string) => Promise<ClaimResult \| null>` | Resolves to the result on success, `null` on failure.        |
| `reset`  | `() => void`                                | Clears back to `idle` — the session itself is still spent, so this doesn't allow retrying. |

A session is single-use: any claim attempt spends it, successfully or not
— except a `429` (rate limited), which never reaches that far. A claim
that fails any other way (a bad domain, a conflict) can't be retried with
the same `sessionToken`; mint a fresh one server-side.

### `useVerification(token, options?)`

Reads, and by default polls, a claim's status by its `frontendToken` (the
one `useClaimDomain` returned, not the spent `sessionToken`). Pass `null`
before a claim exists and it does nothing.

| Field         | Type                                             | Notes                                                    |
| ------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| `verification`| `Verification \| null`                            |                                                               |
| `status`      | `'idle' \| 'loading' \| 'success' \| 'error'`     | Tracks the initial read and every poll tick, not `verify()`. |
| `error`       | `DomainProofError \| null`                        |                                                               |
| `isPolling`   | `boolean`                                          | Whether a background poll is currently scheduled.            |
| `isVerifying` | `boolean`                                          | Whether a manual `verify()` call is in flight.               |
| `verify`      | `() => Promise<void>`                             | Runs the check immediately instead of waiting for the next poll tick. Rate limited by the API: 1 per 15s, 20 per hour, per token. |

Polling uses the same bounded backoff as DomainProof's hosted verification
page — quick at first, settling at 30s, capped at ~40 attempts — and stops
for good once `status` reaches a terminal state (`verified`/`failed`).
Pass `autoPoll: false` to fetch once and drive everything through
`verify()` yourself, or override `intervalsMs`/`maxAttempts`.

## Theming

`<DomainVerification />` ships fully styled with sensible defaults and no
CSS import required — every color, radius, and font is a `--dp-*` custom
property with a built-in fallback, so setting none of them still renders a
clean card. Override any subset on the component itself or any ancestor
element:

```tsx
<div style={{ '--dp-color-accent': '#7c3aed' } as React.CSSProperties}>
  <DomainVerification sessionToken={sessionToken} />
</div>
```

| Variable                  | Default   |
| -------------------------- | --------- |
| `--dp-color-bg`             | `#ffffff` |
| `--dp-color-bg-muted`       | `#f8fafc` |
| `--dp-color-border`         | `#e2e8f0` |
| `--dp-color-text`           | `#0f172a` |
| `--dp-color-text-muted`     | `#64748b` |
| `--dp-color-accent`         | `#2563eb` |
| `--dp-color-accent-contrast`| `#ffffff` |
| `--dp-color-success`        | `#15803d` |
| `--dp-color-success-bg`     | `#f0fdf4` |
| `--dp-color-warning`        | `#b45309` |
| `--dp-color-warning-bg`     | `#fffbeb` |
| `--dp-color-danger`         | `#b91c1c` |
| `--dp-color-danger-bg`      | `#fef2f2` |
| `--dp-radius`               | `10px`    |
| `--dp-font`                 | system sans-serif stack |

## Test mode

A session minted with a `dp_test_...` api key only accepts `.test`
sandbox domains (e.g. `acme.test`), which never touch real DNS — good for
demos and end-to-end tests of your own integration. A live-mode session
claiming a `.test` domain gets `sandbox_requires_test_mode`, surfaced as a
non-retryable claim error the same as any other post-claim failure.
