import { CodeToken } from '@domainproof/ui'
import type { CodePanelTab } from '@domainproof/ui'

/**
 * The claim-a-domain code sample shared by the API, Hosted page, and React
 * components tabs' first step — all three start with the exact same
 * `POST /v1/domains` call, so the sample (and its "Run against sandbox"
 * button) is built once here rather than duplicated per tab. The Node.js
 * tab uses `@domainproof/sdk`'s real constructor and method name
 * (`new DomainProof({ apiKey })`, `domains.claim`) — not the placeholder
 * `domains.create` shape an earlier design pass sketched before the SDK
 * shipped.
 */
export function buildClaimCodeTabs(domain: string): CodePanelTab[] {
  const curlCopy = `# claim a domain, sandbox mode\ncurl -X POST https://api.domainproof.dev/v1/domains \\\n  -H "Authorization: Bearer dp_test_••••…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"domain":"${domain}"}'`

  const wgetCopy = `# claim a domain, sandbox mode\nwget -q -O- https://api.domainproof.dev/v1/domains \\\n  --method=POST \\\n  --header="Authorization: Bearer dp_test_••••…" \\\n  --header="Content-Type: application/json" \\\n  --body-data='{"domain":"${domain}"}'`

  const nodeCopy = `import { DomainProof } from "@domainproof/sdk";\n\nconst domainproof = new DomainProof({ apiKey: "dp_test_••••…" });\nconst { data, error } = await domainproof.domains.claim({\n  domain: "${domain}",\n});`

  return [
    {
      id: 'curl',
      label: 'cURL',
      copyValue: curlCopy,
      code: (
        <>
          <CodeToken kind="comment"># claim a domain, sandbox mode</CodeToken>
          {'\n'}
          curl -X POST https://api.domainproof.dev/v1/domains \{'\n'}
          {'  '}-H{' '}
          <CodeToken kind="string">
            &quot;Authorization: Bearer dp_test_••••…&quot;
          </CodeToken>{' '}
          \{'\n'}
          {'  '}-H{' '}
          <CodeToken kind="string">
            &quot;Content-Type: application/json&quot;
          </CodeToken>{' '}
          \{'\n'}
          {'  '}-d{' '}
          <CodeToken kind="string">
            &apos;{`{"domain":"${domain}"}`}&apos;
          </CodeToken>
        </>
      ),
    },
    {
      id: 'wget',
      label: 'wget',
      copyValue: wgetCopy,
      code: (
        <>
          <CodeToken kind="comment"># claim a domain, sandbox mode</CodeToken>
          {'\n'}
          wget -q -O- https://api.domainproof.dev/v1/domains \{'\n'}
          {'  '}--method=POST \{'\n'}
          {'  '}--header=
          <CodeToken kind="string">
            &quot;Authorization: Bearer dp_test_••••…&quot;
          </CodeToken>{' '}
          \{'\n'}
          {'  '}--header=
          <CodeToken kind="string">
            &quot;Content-Type: application/json&quot;
          </CodeToken>{' '}
          \{'\n'}
          {'  '}--body-data=
          <CodeToken kind="string">
            &apos;{`{"domain":"${domain}"}`}&apos;
          </CodeToken>
        </>
      ),
    },
    {
      id: 'node',
      label: 'Node.js',
      copyValue: nodeCopy,
      code: (
        <>
          <CodeToken kind="keyword">import</CodeToken> {'{ DomainProof }'}{' '}
          <CodeToken kind="keyword">from</CodeToken>{' '}
          <CodeToken kind="string">&quot;@domainproof/sdk&quot;</CodeToken>;
          {'\n\n'}
          <CodeToken kind="keyword">const</CodeToken> domainproof ={' '}
          <CodeToken kind="keyword">new</CodeToken> DomainProof({'{ apiKey: '}
          <CodeToken kind="string">&quot;dp_test_••••…&quot;</CodeToken>
          {' }'});{'\n'}
          <CodeToken kind="keyword">const</CodeToken> {'{ data, error }'} ={' '}
          <CodeToken kind="keyword">await</CodeToken> domainproof.domains.claim
          ({'{'}
          {'\n'}
          {'  '}domain:{' '}
          <CodeToken kind="string">&quot;{domain}&quot;</CodeToken>,{'\n'}
          {'}'});
        </>
      ),
    },
  ]
}
