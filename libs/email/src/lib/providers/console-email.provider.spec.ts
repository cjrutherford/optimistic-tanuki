import { ConsoleEmailProvider } from './console-email.provider';

describe('ConsoleEmailProvider', () => {
  let provider: ConsoleEmailProvider;

  beforeEach(() => {
    provider = new ConsoleEmailProvider();
  });

  it('should have name "console"', () => {
    expect(provider.name).toBe('console');
  });

  it('should send email successfully and return messageId', async () => {
    const result = await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Test Subject',
      text: 'Test Body',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toContain('console-');
  });

  it('should handle array recipients', async () => {
    const result = await provider.sendEmail({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Multi-recipient',
      text: 'Hello all',
    });
    expect(result.success).toBe(true);
  });

  it('should handle html body', async () => {
    const result = await provider.sendEmail({
      to: 'user@example.com',
      subject: 'HTML Test',
      html: '<h1>Hello</h1>',
    });
    expect(result.success).toBe(true);
  });

  it('should always verify connection successfully', async () => {
    expect(await provider.verifyConnection()).toBe(true);
  });

  it('should increment message counter', async () => {
    const r1 = await provider.sendEmail({
      to: 'a@test.com',
      subject: 'First',
      text: 'one',
    });
    const r2 = await provider.sendEmail({
      to: 'b@test.com',
      subject: 'Second',
      text: 'two',
    });
    expect(r1.messageId).not.toBe(r2.messageId);
  });
});
