import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from '../interfaces';

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  /** Default "from" address if not specified in message */
  defaultFrom?: string;
}

/**
 * SMTP email provider plugin.
 * Supports local SMTP, IMAP, and POP mail servers via nodemailer.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly defaultFrom: string;

  constructor(private readonly config: SmtpConfig) {
    this.defaultFrom = config.defaultFrom || 'noreply@localhost';
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? false,
      auth: config.auth,
    });
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: message.from || this.defaultFrom,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        cc: message.cc
          ? Array.isArray(message.cc)
            ? message.cc.join(', ')
            : message.cc
          : undefined,
        bcc: message.bcc
          ? Array.isArray(message.bcc)
            ? message.bcc.join(', ')
            : message.bcc
          : undefined,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      this.logger.debug(`Email sent via SMTP: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP send failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
