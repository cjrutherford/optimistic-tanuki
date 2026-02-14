import { SmtpEmailProvider } from './smtp-email.provider';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
    verify: jest.fn(),
  }),
}));

import * as nodemailer from 'nodemailer';

describe('SmtpEmailProvider', () => {
  let provider: SmtpEmailProvider;
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new SmtpEmailProvider({
      host: 'localhost',
      port: 1025,
      defaultFrom: 'test@example.com',
    });
    mockTransporter = (nodemailer.createTransport as jest.Mock).mock.results[0]
      .value;
  });

  it('should have name "smtp"', () => {
    expect(provider.name).toBe('smtp');
  });

  it('should create transport with correct config', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: undefined,
    });
  });

  it('should send email via nodemailer transporter', async () => {
    mockTransporter.sendMail.mockResolvedValue({
      messageId: 'smtp-msg-1',
    });

    const result = await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('smtp-msg-1');
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'Test',
        text: 'Hello',
      })
    );
  });

  it('should handle send errors', async () => {
    mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection refused'));

    const result = await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP connection refused');
  });

  it('should handle array recipients', async () => {
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-2' });

    await provider.sendEmail({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Multi',
      text: 'Hello',
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com, b@example.com',
      })
    );
  });

  it('should verify connection', async () => {
    mockTransporter.verify.mockResolvedValue(true);
    expect(await provider.verifyConnection()).toBe(true);
  });

  it('should return false on verify failure', async () => {
    mockTransporter.verify.mockRejectedValue(new Error('connection refused'));
    expect(await provider.verifyConnection()).toBe(false);
  });
});
