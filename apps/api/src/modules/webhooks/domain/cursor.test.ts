import { describe, expect, it } from 'vitest'
import { decodeDeliveriesCursor, encodeDeliveriesCursor } from './cursor'

describe('encodeDeliveriesCursor / decodeDeliveriesCursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { id: 'abc-123' }

    const decoded = decodeDeliveriesCursor(encodeDeliveriesCursor(cursor))

    expect(decoded).toEqual(cursor)
  })

  it('returns undefined for garbage input rather than throwing', () => {
    expect(decodeDeliveriesCursor('not-base64-json')).toBeUndefined()
    expect(decodeDeliveriesCursor('')).toBeUndefined()
  })

  it('returns undefined when the decoded shape is missing fields', () => {
    const malformed = Buffer.from(JSON.stringify({})).toString('base64url')
    expect(decodeDeliveriesCursor(malformed)).toBeUndefined()
  })

  it('returns undefined when id is not a string', () => {
    const malformed = Buffer.from(JSON.stringify({ id: 123 })).toString(
      'base64url',
    )
    expect(decodeDeliveriesCursor(malformed)).toBeUndefined()
  })
})
