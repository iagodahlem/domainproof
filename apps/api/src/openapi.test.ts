import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createDb, type Database } from '@infra/db/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

const db: Database = createDb(
  process.env.DATABASE_URL ??
    'postgres://domainproof:domainproof@localhost:5432/domainproof',
)

/** Mirrors `hono-openapi`'s own `:name` -> `{name}` path conversion (see its `utils.ts`'s `toOpenAPIPathSegment`) — every param in this repo's routes is a plain `:name` segment, so this simple version covers them all. */
function toOpenApiPath(path: string): string {
  return path
    .split('/')
    .map((segment) =>
      segment.startsWith(':') ? `{${segment.slice(1)}}` : segment,
    )
    .join('/')
}

async function fetchSpec() {
  const app = createApp({ db })
  const res = await app.request('/v1/openapi.json')
  expect(res.status).toBe(200)
  return {
    app,
    spec: (await res.json()) as {
      paths: Record<string, Record<string, unknown>>
    },
  }
}

describe('GET /v1/openapi.json', () => {
  it('documents every route registered on the v1 and frontend planes', async () => {
    const { app, spec } = await fetchSpec()

    // The plane-wide `.use('*', ...)` middlewares (v1's api-key/rate-limit,
    // frontend's cors) register as method `ALL` on a wildcard path — not a
    // real endpoint to document. `/v1/openapi.json` itself is deliberately
    // excluded from its own document (see `openapi.ts`'s doc comment).
    const expected = new Set<string>()
    for (const route of app.routes) {
      if (route.method === 'ALL') continue
      if (route.path === '/v1/openapi.json') continue
      if (
        !route.path.startsWith('/v1') &&
        !route.path.startsWith('/frontend')
      ) {
        continue
      }
      expected.add(`${route.method.toLowerCase()} ${toOpenApiPath(route.path)}`)
    }
    // A sanity floor so this test can't silently pass against an empty
    // route table (e.g. if the filters above stopped matching anything).
    expect(expected.size).toBeGreaterThanOrEqual(10)

    const documented = new Set<string>()
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const method of Object.keys(methods)) {
        documented.add(`${method} ${path}`)
      }
    }

    const missing = [...expected].filter((entry) => !documented.has(entry))
    expect(missing).toEqual([])
  })

  it('never documents the session-authenticated dashboard plane', async () => {
    const { spec } = await fetchSpec()

    const dashboardPaths = Object.keys(spec.paths).filter((path) =>
      path.startsWith('/dashboard'),
    )
    expect(dashboardPaths).toEqual([])
  })

  it('is valid OpenAPI 3.1, per @redocly/cli lint', async () => {
    const { spec } = await fetchSpec()

    const dir = mkdtempSync(join(tmpdir(), 'domainproof-openapi-'))
    const specPath = join(dir, 'openapi.json')
    writeFileSync(specPath, JSON.stringify(spec))

    try {
      const result = spawnSync(
        join(__dirname, '..', 'node_modules', '.bin', 'redocly'),
        [
          'lint',
          specPath,
          '--config',
          join(__dirname, '..', 'redocly.yaml'),
          '--format=json',
        ],
        { encoding: 'utf-8' },
      )

      const report = JSON.parse(result.stdout) as {
        problems: Array<{ severity: string; message: string; ruleId: string }>
      }
      const errors = report.problems.filter((p) => p.severity === 'error')
      expect(errors).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
