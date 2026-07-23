export interface McpConfig {
  apiKey: string
  baseUrl?: string
}

const SETUP_HINT =
  "Create one from your DomainProof dashboard, then set it in this server's environment, e.g.\n" +
  '  claude mcp add domainproof -e DOMAINPROOF_API_KEY=dp_test_... -- npx -y @domainproof/mcp'

/** Reads server config from the environment, failing fast with an actionable message if the api key is missing. */
export function loadConfig(env: NodeJS.ProcessEnv): McpConfig {
  const apiKey = env.DOMAINPROOF_API_KEY
  if (!apiKey) {
    throw new Error(`DOMAINPROOF_API_KEY is required. ${SETUP_HINT}`)
  }

  return { apiKey, baseUrl: env.DOMAINPROOF_BASE_URL }
}
