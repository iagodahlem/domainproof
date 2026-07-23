#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DomainProof } from '@domainproof/sdk'
import { loadConfig } from './config'
import { StdioServerTransport } from './mcp-sdk'
import { createServer } from './server'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PackageJson {
  version: string
}

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as PackageJson

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const client = new DomainProof({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  })

  const server = createServer(client, pkg.version)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  // stdout is the JSON-RPC channel for this transport — startup failures go to stderr.
  console.error(
    `domainproof-mcp: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
})
