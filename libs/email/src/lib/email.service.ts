import { Injectable, Logger } from '@nestjs/common';
import { EmailPluginRegistry } from './email-plugin-registry';
import { EmailMessage, EmailSendResult } from './interfaces';

/**
 * Main email service that delegates to the active provider plugin.
 * Applications inject this service to send emails.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly registry: EmailPluginRegistry) {}

  /**
   * Send an email using the active provider.
   */
  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const provider = this.registry.getActiveProvider();
    if (!provider) {
      this.logger.warn('No email provider is active. Email not sent.');
      return { success: false, error: 'No email provider configured' };
    }
    try {
      this.logger.debug(
        `Sending email via ${provider.name} to ${
          Array.isArray(message.to) ? message.to.join(', ') : message.to
        }`
      );
      return await provider.sendEmail(message);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email via ${provider.name}: ${errMsg}`
      );
      return { success: false, error: errMsg };
    }
  }

  /**
   * Verify the active provider connection is working.
   */
  async verifyConnection(): Promise<boolean> {
    const provider = this.registry.getActiveProvider();
    if (!provider) {
      return false;
    }
    try {
      return await provider.verifyConnection();
    } catch {
      return false;
    }
  }
}
