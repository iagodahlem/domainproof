import { describe, expect, it } from 'vitest'
import { computeGrade } from './grade'
import type { CheckResult, CheckStatus } from './types'

function check(status: CheckStatus): CheckResult {
  return { id: 'x', title: 'X', tier: 'teaser', status, summary: '' }
}

describe('computeGrade', () => {
  it('grades all-pass as A', () => {
    expect(computeGrade([check('pass'), check('pass')]).grade).toBe('A')
  })

  it('grades all-fail as F', () => {
    expect(computeGrade([check('fail'), check('fail')]).grade).toBe('F')
  })

  it('grades a mix in the middle as C', () => {
    expect(
      computeGrade([check('pass'), check('pass'), check('warn'), check('fail')])
        .grade,
    ).toBe('C')
  })

  it('returns F with no data for an empty check list', () => {
    expect(computeGrade([])).toEqual({ grade: 'F', label: 'No data' })
  })
})
