import { Logger } from '@nestjs/common';
import {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from '../interfaces';

export interface HttpApiEmailConfig {
  /** The API endpoint URL */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Default "from" address if not specified in message */
  defaultFrom?: string;
  /** Provider name identifier */
  providerName?: string;
  /** Custom headers to include with API requests */
  headers?: Record<string, string>;
}

/**
 * HTTP API-based email provider plugin.
 *
 * Works with third-party email APIs like SendGrid, Mailgun, etc.
 * Sends email via HTTP POST to the configured API endpoint.
 */
export class HttpApiEmailProvider implements EmailProvider {
  readonly name: string;
  private readonly logger: Logger;
  private readonly config: HttpApiEmailConfig;

  constructor(config: HttpApiEmailConfig) {
    this.name = config.providerName || 'http-api';
    this.logger = new Logger(`HttpApiEmailProvider[${this.name}]`);
    this.config = config;
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const body = {
        from: message.from || this.config.defaultFrom || 'noreply@localhost',
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        cc: message.cc
          ? Array.isArray(message.cc)
            ? message.cc
            : [message.cc]
          : undefined,
        bcc: message.bcc
          ? Array.isArray(message.bcc)
            ? message.bcc
            : [message.bcc]
          : undefined,
        replyTo: message.replyTo,
      };

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `HTTP API email send failed (${response.status}): ${errorText}`
        );
        return { success: false, error: `API error: ${response.status}` };
      }

      const result = await response.json();
      this.logger.debug(`Email sent via ${this.name}: ${JSON.stringify(result)}`);
      return { success: true, messageId: result.id || result.messageId };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`${this.name} send failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          ...this.config.headers,
        },
      });
      return response.ok || response.status === 405;
    } catch {
      return false;
    }
  }
}
