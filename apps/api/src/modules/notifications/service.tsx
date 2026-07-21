import type { DomainEventSubscriber, Mode } from '@shared/events'
import type { Logger } from '@shared/logger'
import { renderEmail } from './domain/render'
import { DomainVerifiedEmail } from './domain/templates/domain-verified'
import { GraceWindowEmail } from './domain/templates/grace-window'
import { VerificationFailedEmail } from './domain/templates/verification-failed'
import { WelcomeEmail } from './domain/templates/welcome'
import type { EmailSender } from './ports'

/**
 * Prefixes the subject for test-mode notifications, so a builder testing
 * their integration can't confuse a test-mode email for a live one.
 * `mode: undefined` covers `account.created`, which isn't mode-scoped
 * (an account isn't test/live, only its projects' domains and keys are)
 * — it gets no prefix, same as a live-mode notification.
 */
function subjectFor(base: string, mode: Mode | undefined): string {
  return mode === 'test' ? `[test] ${base}` : base
}

export interface NotificationsDeps {
  emailSender: EmailSender
  /** Resolves the builder email to notify for a domain event's project — see `modules/accounts/service.ts`'s `getEmailForProject`. */
  getAccountEmailByProjectId: (projectId: string) => Promise<string | undefined>
  logger: Logger
}

export interface NotificationsService {
  onAccountCreated: DomainEventSubscriber<'account.created'>
  onDomainVerified: DomainEventSubscriber<'domain.verified'>
  onDomainTemporarilyFailed: DomainEventSubscriber<'domain.temporarily_failed'>
  onDomainFailed: DomainEventSubscriber<'domain.failed'>
}

/**
 * Builds the event subscribers that turn published events into emails.
 * Each subscriber is a plain function this module exports — registering
 * them against the `EventBus` is composition-root wiring, done in
 * `app.ts`, not this module's job (see ARCHITECTURE.md's "Planned:
 * events"). Emails send in both modes; only the subject gets a `[test] `
 * prefix for a test-mode domain event (see `subjectFor`). A missing
 * recipient email (see `modules/accounts/service.ts` — not every account
 * has one) is a logged skip here, never a thrown error: a notification is
 * a side effect of an event, not something that should ever surface as a
 * failure to the request that triggered it.
 */
export function createNotificationsService(
  deps: NotificationsDeps,
): NotificationsService {
  const logger = deps.logger

  async function sendToAccount(
    projectId: string,
    subject: string,
    render: () => Promise<{ html: string; text: string }>,
    context: string,
  ): Promise<void> {
    const email = await deps.getAccountEmailByProjectId(projectId)
    if (!email) {
      logger.info(
        { projectId, subject, context },
        'Skipping email: no account email on file',
      )
      return
    }

    const { html, text } = await render()
    await deps.emailSender.send({ to: email, subject, html, text })
  }

  return {
    async onAccountCreated(payload) {
      if (!payload.email) {
        logger.info(
          { accountId: payload.accountId },
          'Skipping welcome email: no email on file',
        )
        return
      }

      const { html, text } = await renderEmail(<WelcomeEmail />)
      await deps.emailSender.send({
        to: payload.email,
        subject: 'Welcome to DomainProof',
        html,
        text,
      })
    },

    async onDomainVerified(payload) {
      await sendToAccount(
        payload.projectId,
        subjectFor(`${payload.domain} is verified`, payload.mode),
        () => renderEmail(<DomainVerifiedEmail domain={payload.domain} />),
        'domain.verified',
      )
    },

    async onDomainTemporarilyFailed(payload) {
      await sendToAccount(
        payload.projectId,
        subjectFor(
          `${payload.domain}: rechecking your DNS record`,
          payload.mode,
        ),
        () => renderEmail(<GraceWindowEmail domain={payload.domain} />),
        'domain.temporarily_failed',
      )
    },

    async onDomainFailed(payload) {
      await sendToAccount(
        payload.projectId,
        subjectFor(`${payload.domain} verification failed`, payload.mode),
        () => renderEmail(<VerificationFailedEmail domain={payload.domain} />),
        'domain.failed',
      )
    },
  }
}
