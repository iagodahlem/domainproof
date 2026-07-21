import { describe, expect, it, vi } from 'vitest'
import type { EmailMessage, EmailSender } from './ports'
import { createNotificationsService } from './service'

/** A fake `EmailSender` implementing the port in memory — no real network call, per the repo's testing convention for module ports. */
function fakeEmailSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = []
  return {
    sent,
    async send(message) {
      sent.push(message)
    },
  }
}

describe('onAccountCreated', () => {
  it('sends a welcome email to the account email', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async () => undefined,
    })

    await service.onAccountCreated({
      accountId: 'account_1',
      clerkUserId: 'user_1',
      email: 'builder@example.com',
    })

    expect(emailSender.sent).toHaveLength(1)
    expect(emailSender.sent[0]).toMatchObject({
      to: 'builder@example.com',
      subject: 'Welcome to DomainProof',
    })
    expect(emailSender.sent[0]?.html).toContain('Welcome to DomainProof')
    expect(emailSender.sent[0]?.text.length).toBeGreaterThan(0)
  })

  it('logs and skips when the account has no email', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async () => undefined,
    })
    const consoleLog = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)

    await service.onAccountCreated({
      accountId: 'account_1',
      clerkUserId: 'user_1',
      email: null,
    })

    expect(emailSender.sent).toHaveLength(0)
    expect(consoleLog).toHaveBeenCalled()
    consoleLog.mockRestore()
  })
})

describe('onDomainVerified', () => {
  it('resolves the recipient by projectId and sends the verified email', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async (projectId) =>
        projectId === 'project_1' ? 'builder@example.com' : undefined,
    })

    await service.onDomainVerified({
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(emailSender.sent).toHaveLength(1)
    expect(emailSender.sent[0]).toMatchObject({
      to: 'builder@example.com',
      subject: 'example.com is verified',
    })
  })

  it('prefixes the subject with [test] for a test-mode domain event', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async () => 'builder@example.com',
    })

    await service.onDomainVerified({
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'test',
      domain: 'example.com',
    })

    expect(emailSender.sent[0]?.subject).toBe('[test] example.com is verified')
  })

  it('logs and skips when the project has no account email on file', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async () => undefined,
    })
    const consoleLog = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)

    await service.onDomainVerified({
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(emailSender.sent).toHaveLength(0)
    expect(consoleLog).toHaveBeenCalled()
    consoleLog.mockRestore()
  })
})

describe('onDomainTemporarilyFailed', () => {
  it('sends the grace-window email', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async () => 'builder@example.com',
    })

    await service.onDomainTemporarilyFailed({
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(emailSender.sent[0]).toMatchObject({
      to: 'builder@example.com',
      subject: 'example.com: rechecking your DNS record',
    })
    expect(emailSender.sent[0]?.html).toContain('72 hours')
  })
})

describe('onDomainFailed', () => {
  it('sends the verification-failed email', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async () => 'builder@example.com',
    })

    await service.onDomainFailed({
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'live',
      domain: 'example.com',
    })

    expect(emailSender.sent[0]).toMatchObject({
      to: 'builder@example.com',
      subject: 'example.com verification failed',
    })
  })

  it('prefixes the subject with [test] for a test-mode domain event', async () => {
    const emailSender = fakeEmailSender()
    const service = createNotificationsService({
      emailSender,
      getAccountEmailByProjectId: async () => 'builder@example.com',
    })

    await service.onDomainFailed({
      domainId: 'domain_1',
      projectId: 'project_1',
      mode: 'test',
      domain: 'example.com',
    })

    expect(emailSender.sent[0]?.subject).toBe(
      '[test] example.com verification failed',
    )
  })
})
