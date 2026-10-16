import { EmailService } from './email.service';
import { EmailPluginRegistry } from './email-plugin-registry';
import { EmailProvider, EmailMessage, EmailSendResult } from './interfaces';

class MockProvider implements EmailProvider {
  readonly name = 'mock';
  sendEmailFn = jest.fn<Promise<EmailSendResult>, [EmailMessage]>();
  verifyFn = jest.fn<Promise<boolean>, []>();

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    return this.sendEmailFn(message);
  }
  async verifyConnection(): Promise<boolean> {
    return this.verifyFn();
  }
}

describe('EmailService', () => {
  let service: EmailService;
  let registry: EmailPluginRegistry;
  let mockProvider: MockProvider;

  beforeEach(() => {
    registry = new EmailPluginRegistry();
    mockProvider = new MockProvider();
    registry.register(mockProvider);
    service = new EmailService(registry);
  });

  it('should send email via active provider', async () => {
    mockProvider.sendEmailFn.mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });

    const message: EmailMessage = {
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    };

    const result = await service.sendEmail(message);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-1');
    expect(mockProvider.sendEmailFn).toHaveBeenCalledWith(message);
  });

  it('should return error when no provider is configured', async () => {
    const emptyRegistry = new EmailPluginRegistry();
    const emptyService = new EmailService(emptyRegistry);

    const result = await emptyService.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No email provider configured');
  });

  it('should handle provider errors gracefully', async () => {
    mockProvider.sendEmailFn.mockRejectedValue(new Error('SMTP timeout'));

    const result = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP timeout');
  });

  it('redacts recipient and provider error details for sensitive email logs', async () => {
    const logger = (service as any).logger;
    const logMessages: string[] = [];
    jest.spyOn(logger, 'debug').mockImplementation((...args: unknown[]) => {
      logMessages.push(args.map(String).join(' '));
    });
    jest.spyOn(logger, 'error').mockImplementation((...args: unknown[]) => {
      logMessages.push(args.map(String).join(' '));
    });
    mockProvider.sendEmailFn.mockRejectedValue(
      new Error('rejected private-guardian@example.test')
    );

    await service.sendEmail({
      to: 'private-guardian@example.test',
      subject: 'Guardian notice',
      text: 'Private notice content',
      sensitive: true,
    });

    expect(logMessages.join('\n')).not.toContain(
      'private-guardian@example.test'
    );
    expect(logMessages.join('\n')).not.toContain('Private notice content');
    expect(logMessages.join('\n')).toContain('Failed to send sensitive email');
  });

  it('should verify connection via active provider', async () => {
    mockProvider.verifyFn.mockResolvedValue(true);
    expect(await service.verifyConnection()).toBe(true);
  });

  it('should return false when no provider for verify', async () => {
    const emptyRegistry = new EmailPluginRegistry();
    const emptyService = new EmailService(emptyRegistry);
    expect(await emptyService.verifyConnection()).toBe(false);
  });

  it('should handle verify connection errors', async () => {
    mockProvider.verifyFn.mockRejectedValue(new Error('connection refused'));
    expect(await service.verifyConnection()).toBe(false);
  });
});
