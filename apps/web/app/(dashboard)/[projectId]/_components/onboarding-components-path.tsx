import { CopyButton } from '@domainproof/ui'
import type { VerticalTimelineStep } from '@domainproof/ui'
import { LiveComponentPreview } from './onboarding-live-component'
import { WALKTHROUGH_SURFACE_MAX_WIDTH } from './onboarding-constants'

function SnippetBlock({ code }: { code: string }) {
  return (
    <div className={`relative ${WALKTHROUGH_SURFACE_MAX_WIDTH}`}>
      <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 pr-22 font-mono text-xs leading-code break-words whitespace-pre-wrap">
        {code}
      </pre>
      <CopyButton value={code} size="sm" className="absolute top-3 right-3">
        Copy
      </CopyButton>
    </div>
  )
}

const INSTALL_SNIPPET = 'npm install @domainproof/react'

const MINT_SESSION_SNIPPET = `import { DomainProof } from "@domainproof/sdk";

const domainproof = new DomainProof({ apiKey: "dp_test_••••…" });
const { data, error } = await domainproof.componentSessions.create();
// hand data.sessionToken to your frontend`

const RENDER_SNIPPET = `'use client'
import { DomainVerification } from "@domainproof/react";

<DomainVerification
  sessionToken={sessionToken}
  onVerified={(verification) => console.log(\`\${verification.domain} verified\`)}
/>`

/**
 * The React components tab is reference material, not a live walkthrough —
 * `@domainproof/react`'s `<DomainVerification />` claims its own domain
 * from a browser-supplied session token (see the package's README), so
 * there's no dashboard-side "claim" action to run against the sandbox the
 * way the API/Hosted tabs have. Three steps: install the package, mint a
 * session server-side, drop the component in — matching
 * `@domainproof/react`'s actual exports (`DomainVerification`, backed by
 * `@domainproof/sdk`'s `componentSessions.create`), not the separate
 * `RecordCard`/`VerificationStatus` components an earlier design pass
 * sketched before the package shipped as one drop-in component instead.
 */
export interface ComponentsPathStepsInput {
  projectId: string
}

export function buildComponentsPathSteps({
  projectId,
}: ComponentsPathStepsInput): VerticalTimelineStep[] {
  return [
    {
      id: 'install',
      status: 'current',
      node: '1',
      title: 'Install the package',
      description: 'Add the drop-in verification component to your app.',
      content: <SnippetBlock code={INSTALL_SNIPPET} />,
    },
    {
      id: 'mint-session',
      status: 'upcoming',
      node: '2',
      title: 'Mint a session server-side',
      description:
        'From your backend, spend your saved test key on a short-lived, single-use session token — never send the key itself to the browser.',
      content: <SnippetBlock code={MINT_SESSION_SNIPPET} />,
    },
    {
      id: 'render',
      status: 'upcoming',
      node: '3',
      title: 'Drop in <DomainVerification />',
      description:
        'It claims the domain, shows the record, and polls status automatically — no separate record card or status component to wire up. Try it below: the real component, talking to a real session.',
      content: (
        <>
          <SnippetBlock code={RENDER_SNIPPET} />
          <LiveComponentPreview projectId={projectId} />
        </>
      ),
    },
  ]
}
