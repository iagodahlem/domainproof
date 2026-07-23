import { describe, expect, it } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import { errorResult, jsonResult } from './tool-result'

describe('jsonResult', () => {
  it('serializes the payload as a single text content block', () => {
    const result = jsonResult({ domain: { id: 'dom_1' } })

    expect(result.isError).toBeUndefined()
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify({ domain: { id: 'dom_1' } }) },
    ])
  })
})

describe('errorResult', () => {
  it('marks the result as an error and includes the code, message, and status', () => {
    const error = new DomainProofApiError('not_found', 'Domain not found', 404)

    const result = errorResult(error)

    expect(result.isError).toBe(true)
    const [content] = result.content
    expect(content?.type).toBe('text')
    expect(JSON.parse((content as { text: string }).text)).toEqual({
      error: {
        code: 'not_found',
        message: expect.stringMatching(/list_domains/),
        status: 404,
      },
    })
  })
})
