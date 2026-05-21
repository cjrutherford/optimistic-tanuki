import { Logger } from '@nestjs/common';
import {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from '../interfaces';

/**
 * Console email provider plugin.
 * Logs emails to console instead of sending them.
 * Useful for development and testing.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleEmailProvider.name);
  private counter = 0;

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    this.counter++;
    const messageId = `console-${this.counter}-${Date.now()}`;
    this.logger.log(
      `[Console Email] To: ${
        Array.isArray(message.to) ? message.to.join(', ') : message.to
      } | Subject: ${message.subject}`
    );
    if (message.text) {
      this.logger.log(`[Console Email] Body: ${message.text}`);
    }
    if (message.html) {
      this.logger.log(`[Console Email] HTML body length: ${message.html.length}`);
    }
    return { success: true, messageId };
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }
}
