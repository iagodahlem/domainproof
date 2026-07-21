import { Resend } from 'resend'
import type { EmailSender } from '@modules/notifications/ports'
import type { Logger } from '@shared/logger'

export interface ResendEmailSenderConfig {
  apiKey: string
  /** e.g. `DomainProof <notifications@domainproof.dev>` — see `env.ts`'s `EMAIL_FROM`. */
  from: string
}

/**
 * The only file in this api allowed to talk to Resend directly —
 * implements the notifications module's {@link EmailSender} port over the
 * official `resend` SDK. Everything above this (the notification
 * subscribers, `app.ts`'s wiring) depends on the port, never on this
 * concrete adapter.
 *
 * Never throws: a delivery failure (Resend API error, or the request
 * itself failing) is logged and swallowed, matching the port's contract —
 * sending an email is a side effect of an event, not something that
 * should ever surface as a failure to the request that published it.
 */
export function createResendEmailSender(
  config: ResendEmailSenderConfig,
  logger: Logger,
): EmailSender {
  const client = new Resend(config.apiKey)

  return {
    async send({ to, subject, html, text }) {
      try {
        const { error } = await client.emails.send({
          from: config.from,
          to,
          subject,
          html,
          text,
        })
        if (error) {
          logger.error({ error }, 'Resend rejected an email send')
        }
      } catch (err) {
        logger.error({ err }, 'Failed to send email via Resend')
      }
    },
  }
}
