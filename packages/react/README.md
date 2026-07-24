# @domainproof/react

Embeddable React hooks and a drop-in `<DomainVerification />` component for
[DomainProof](https://domainproof.dev) domain-ownership verification —
claim a domain, show the DNS record to publish, and poll for verification,
all from a component in your own frontend.

`<DomainVerification />` renders DomainProof's own design system — the
same `RecordCard`, status pill, and stepper the hosted verification page
and dashboard use — via a precompiled stylesheet, so it looks like part of
the product rather than a generic embed.

Talks directly to DomainProof's Frontend API (`/frontend/*`) over native
`fetch` — no runtime dependency on `@domainproof/sdk` (that's the
server-side client) or any DomainProof workspace package at runtime (the
design-system components are compiled straight into this package's
bundle). Ships both ESM and CommonJS builds. Peer-depends on `react >=18`.

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

   const domainproof = new DomainProof({
     apiKey: process.env.DOMAINPROOF_API_KEY!,
   })
   const { data, error } = await domainproof.componentSessions.create()
   if (error) throw error

   // Hand data.sessionToken to your frontend — it's single-use and expires in an hour.
   ```

2. Import the stylesheet once (anywhere in your app — a root layout, your
   entry file) and pass `sessionToken` to the component:

   ```tsx
   'use client'

   import { DomainVerification } from '@domainproof/react'
   import '@domainproof/react/styles.css'

   export function ConnectDomain({ sessionToken }: { sessionToken: string }) {
     return (
       <DomainVerification
         sessionToken={sessionToken}
         onVerified={(verification) =>
           console.log(`${verification.domain} verified`)
         }
       />
     )
   }
   ```

That's it — no Tailwind or build-step setup required in your app. The
component handles claiming the domain, showing the TXT record (with copy
buttons), a status pill and progress stepper, an auto-checking indicator,
and the verified/failed outcome states.

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

## Rendering an existing claim

If you already claimed the domain some other way (server-side, via
`@domainproof/sdk`'s `domains.claim`) and just want this component to show
that claim's live status, pass `frontendToken` instead of `sessionToken` —
it skips the claim step entirely and renders the record card right away.
`frontendToken` is the last path segment of the claim's own
`verificationUrl` (the same token the hosted verification page,
`/verify/:token`, uses):

```tsx
<DomainVerification
  frontendToken={verificationUrl.split('/').pop()}
  onVerified={(verification) => console.log(`${verification.domain} verified`)}
/>
```

`sessionToken` and `frontendToken` are mutually exclusive — pass exactly
one.

## Headless hooks

Compose these directly instead of `<DomainVerification />` for full control
over markup and styling.

### `useClaimDomain(sessionToken, options?)`

Spends a component session to claim a domain —
`POST /frontend/component-sessions/:sessionToken/claim`.

| Field    | Type                                               | Notes                                                                                      |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `status` | `'idle' \| 'claiming' \| 'success' \| 'error'`     |                                                                                            |
| `data`   | `ClaimResult \| null`                              | Set on success. `data.frontendToken` feeds `useVerification` below.                        |
| `error`  | `DomainProofError \| null`                         | `{ kind: 'http', status, code, message }` or `{ kind: 'network', message }`                |
| `claim`  | `(domain: string) => Promise<ClaimResult \| null>` | Resolves to the result on success, `null` on failure.                                      |
| `reset`  | `() => void`                                       | Clears back to `idle` — the session itself is still spent, so this doesn't allow retrying. |

A session is single-use: any claim attempt spends it, successfully or not
— except a `429` (rate limited), which never reaches that far. A claim
that fails any other way (a bad domain, a conflict) can't be retried with
the same `sessionToken`; mint a fresh one server-side.

### `useVerification(token, options?)`

Reads, and by default polls, a claim's status by its `frontendToken` (the
one `useClaimDomain` returned, not the spent `sessionToken`). Pass `null`
before a claim exists and it does nothing.

| Field          | Type                                          | Notes                                                                                                                             |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `verification` | `Verification \| null`                        |                                                                                                                                   |
| `status`       | `'idle' \| 'loading' \| 'success' \| 'error'` | Tracks the initial read and every poll tick, not `verify()`.                                                                      |
| `error`        | `DomainProofError \| null`                    |                                                                                                                                   |
| `isPolling`    | `boolean`                                     | Whether a background poll is currently scheduled.                                                                                 |
| `isVerifying`  | `boolean`                                     | Whether a manual `verify()` call is in flight.                                                                                    |
| `verify`       | `() => Promise<void>`                         | Runs the check immediately instead of waiting for the next poll tick. Rate limited by the API: 1 per 15s, 20 per hour, per token. |

Polling uses the same bounded backoff as DomainProof's hosted verification
page — quick at first, settling at 30s, capped at ~40 attempts — and stops
for good once `status` reaches a terminal state (`verified`/`failed`).
Pass `autoPoll: false` to fetch once and drive everything through
`verify()` yourself, or override `intervalsMs`/`maxAttempts`.

## Styling

Import `@domainproof/react/styles.css` once, anywhere in your app. It's a
precompiled stylesheet — built at publish time by scanning this package's
and `@domainproof/ui`'s (DomainProof's internal, unpublished design
system) source for the classes `<DomainVerification />` actually uses, so
your app never needs Tailwind installed or configured. Every rule in it is
scoped under the component's own root element, so it can't collide with or
override styles elsewhere on your page.

`<DomainVerification />` ships two color themes — the same tokens the rest
of DomainProof themes with. Pick one with the `theme` prop (defaults to
`'dark'`):

```tsx
<DomainVerification sessionToken={sessionToken} theme="light" />
```

For finer control, every token is a CSS custom property you can override
via the `style` prop on the component itself (not an ancestor element —
the compiled stylesheet declares these directly on the component's own
root, and a direct declaration always wins over one inherited from
further up the tree):

```tsx
<DomainVerification
  sessionToken={sessionToken}
  style={{ '--accent': '#7c3aed' } as React.CSSProperties}
/>
```

| Variable               | Dark (default)                   | Light                        |
| ---------------------- | -------------------------------- | ---------------------------- |
| `--bg`                 | `oklch(0.13 0.006 235)`          | `oklch(0.99 0.002 235)`      |
| `--surface`            | `oklch(0.17 0.008 235)`          | `oklch(0.975 0.004 235)`     |
| `--border`             | `oklch(1 0 0 / 8%)`              | `oklch(0.13 0.01 235 / 10%)` |
| `--text`               | `oklch(0.96 0.004 235)`          | `oklch(0.18 0.01 235)`       |
| `--text-muted`         | `oklch(0.66 0.01 235)`           | `oklch(0.42 0.012 235)`      |
| `--accent`             | `oklch(0.76 0.16 152)`           | `oklch(0.52 0.15 152)`       |
| `--success`            | `oklch(0.76 0.16 152)`           | `oklch(0.5 0.15 152)`        |
| `--warning`            | `oklch(0.82 0.175 96)`           | `oklch(0.64 0.165 88)`       |
| `--danger`             | `oklch(0.68 0.19 25)`            | `oklch(0.55 0.19 25)`        |
| `--radius-sm/md/lg/xl` | `6px` / `10px` / `14px` / `20px` | same                         |

See `@domainproof/ui`'s `tokens.css` for the complete list (border tints,
type scale, shadows) — every value there is overridable the same way.

## Test mode

A session minted with a `dp_test_...` api key only accepts `.test`
sandbox domains (e.g. `acme.test`), which never touch real DNS — good for
demos and end-to-end tests of your own integration. A live-mode session
claiming a `.test` domain gets `sandbox_requires_test_mode`, surfaced as a
non-retryable claim error the same as any other post-claim failure.
