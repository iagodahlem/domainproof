import { describe, expect, it } from 'vitest'
import { decodeDomainsCursor, encodeDomainsCursor } from './cursor'

describe('encodeDomainsCursor / decodeDomainsCursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { id: 'abc-123' }

    const decoded = decodeDomainsCursor(encodeDomainsCursor(cursor))

    expect(decoded).toEqual(cursor)
  })

  it('returns undefined for garbage input rather than throwing', () => {
    expect(decodeDomainsCursor('not-base64-json')).toBeUndefined()
    expect(decodeDomainsCursor('')).toBeUndefined()
  })

  it('returns undefined when the decoded shape is missing fields', () => {
    const malformed = Buffer.from(JSON.stringify({})).toString('base64url')
    expect(decodeDomainsCursor(malformed)).toBeUndefined()
  })

  it('returns undefined when id is not a string', () => {
    const malformed = Buffer.from(JSON.stringify({ id: 123 })).toString(
      'base64url',
    )
    expect(decodeDomainsCursor(malformed)).toBeUndefined()
  })
})
