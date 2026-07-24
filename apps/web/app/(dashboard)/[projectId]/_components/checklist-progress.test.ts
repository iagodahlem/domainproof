import { describe, expect, it } from 'vitest'
import { deriveChecklistProgress } from './checklist-progress'

describe('deriveChecklistProgress', () => {
  it('marks only "create project" done for a fresh project', () => {
    const progress = deriveChecklistProgress({
      anyDomainVerified: false,
      anyWebhookRegistered: false,
    })
    expect(progress.steps.map((step) => step.status)).toEqual([
      'done',
      'current',
      'upcoming',
    ])
    expect(progress.doneCount).toBe(1)
    expect(progress.requiredDone).toBe(false)
  })

  it('marks "first run" done once any domain has verified, regardless of path', () => {
    const progress = deriveChecklistProgress({
      anyDomainVerified: true,
      anyWebhookRegistered: false,
    })
    expect(progress.steps.map((step) => step.status)).toEqual([
      'done',
      'done',
      'upcoming',
    ])
    expect(progress.doneCount).toBe(2)
    expect(progress.requiredDone).toBe(true)
  })

  it('marks "add a webhook" done once any endpoint is registered, without requiring it for requiredDone', () => {
    const progress = deriveChecklistProgress({
      anyDomainVerified: false,
      anyWebhookRegistered: true,
    })
    expect(progress.steps.map((step) => step.status)).toEqual([
      'done',
      'current',
      'done',
    ])
    expect(progress.doneCount).toBe(2)
    expect(progress.requiredDone).toBe(false)
  })

  it('marks all three steps done once every signal is true', () => {
    const progress = deriveChecklistProgress({
      anyDomainVerified: true,
      anyWebhookRegistered: true,
    })
    expect(progress.steps.map((step) => step.status)).toEqual([
      'done',
      'done',
      'done',
    ])
    expect(progress.doneCount).toBe(3)
    expect(progress.requiredDone).toBe(true)
  })
})
