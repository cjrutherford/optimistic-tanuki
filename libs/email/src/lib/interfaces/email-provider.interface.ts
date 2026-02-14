/**
 * Email Provider Interface
 *
 * All email plugins must implement this interface.
 * This enables a plug-in architecture for email providers,
 * supporting both local SMTP/IMAP/POP and third-party email APIs.
 */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailTemplateData {
  [key: string]: string | number | boolean | undefined;
}

export interface EmailProvider {
  /** Unique name for this provider (e.g. 'smtp', 'sendgrid', 'ses') */
  readonly name: string;

  /** Send a raw email message */
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;

  /** Verify the provider connection is working */
  verifyConnection(): Promise<boolean>;
}
