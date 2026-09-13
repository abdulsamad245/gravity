import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { config } from '../../config/config';
import { logger } from '../../observability/logger';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null | undefined;

function getTransporter(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null {
  if (transporter !== undefined) return transporter;
  if (!config.inviteEmailConfigured || !config.SMTP_HOST || !config.INVITE_FROM_EMAIL) {
    transporter = null;
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER
      ? {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS ?? '',
        }
      : undefined,
  });
  return transporter;
}

/**
 * Attempt delivery. Throws on transport errors so the email queue can retry.
 * Returns `deferred` when SMTP is not configured (queue logs and completes).
 */
export async function sendEmail(mail: OutboundEmail): Promise<'sent' | 'deferred'> {
  const tx = getTransporter();
  if (!tx || !config.INVITE_FROM_EMAIL) {
    logger.info(
      {
        event: 'email_deferred',
        to: mail.to,
        subject: mail.subject,
        reason: 'smtp_not_configured',
      },
      'Invite email deferred (SMTP credentials not set)',
    );
    return 'deferred';
  }

  await tx.sendMail({
    from: `"${config.INVITE_FROM_NAME}" <${config.INVITE_FROM_EMAIL}>`,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  logger.info({ event: 'email_sent', to: mail.to, subject: mail.subject }, 'Invite email sent');
  return 'sent';
}
