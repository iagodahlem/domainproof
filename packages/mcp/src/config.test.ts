import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

describe('loadConfig', () => {
  it('reads the api key and base url from the environment', () => {
    const config = loadConfig({
      DOMAINPROOF_API_KEY: 'dp_test_abc123',
      DOMAINPROOF_BASE_URL: 'http://localhost:3001',
    } as NodeJS.ProcessEnv)

    expect(config).toEqual({
      apiKey: 'dp_test_abc123',
      baseUrl: 'http://localhost:3001',
    })
  })

  it('leaves baseUrl undefined when not set', () => {
    const config = loadConfig({
      DOMAINPROOF_API_KEY: 'dp_test_abc123',
    } as NodeJS.ProcessEnv)

    expect(config.baseUrl).toBeUndefined()
  })

  it('throws a message pointing to the dashboard and claude mcp add when the api key is missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrowError(
      /DOMAINPROOF_API_KEY is required/,
    )
  })
})
