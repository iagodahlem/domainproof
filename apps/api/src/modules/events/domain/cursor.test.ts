import { describe, expect, it } from 'vitest'
import { decodeEventsCursor, encodeEventsCursor } from './cursor'

describe('encodeEventsCursor / decodeEventsCursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { id: 'abc-123' }

    const decoded = decodeEventsCursor(encodeEventsCursor(cursor))

    expect(decoded).toEqual(cursor)
  })

  it('returns undefined for garbage input rather than throwing', () => {
    expect(decodeEventsCursor('not-base64-json')).toBeUndefined()
    expect(decodeEventsCursor('')).toBeUndefined()
  })

  it('returns undefined when the decoded shape is missing fields', () => {
    const malformed = Buffer.from(JSON.stringify({})).toString('base64url')
    expect(decodeEventsCursor(malformed)).toBeUndefined()
  })

  it('returns undefined when id is not a string', () => {
    const malformed = Buffer.from(JSON.stringify({ id: 123 })).toString(
      'base64url',
    )
    expect(decodeEventsCursor(malformed)).toBeUndefined()
  })
})
