import { HttpApiEmailProvider } from './http-api-email.provider';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('HttpApiEmailProvider', () => {
  let provider: HttpApiEmailProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new HttpApiEmailProvider({
      apiUrl: 'https://api.sendgrid.com/v3/mail/send',
      apiKey: 'SG.test-key',
      defaultFrom: 'noreply@example.com',
      providerName: 'sendgrid',
    });
  });

  it('should have the configured name', () => {
    expect(provider.name).toBe('sendgrid');
  });

  it('should default name to "http-api" when not specified', () => {
    const defaultProvider = new HttpApiEmailProvider({
      apiUrl: 'https://api.example.com/send',
      apiKey: 'key',
    });
    expect(defaultProvider.name).toBe('http-api');
  });

  it('should send email via HTTP POST', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'api-msg-1' }),
    });

    const result = await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('api-msg-1');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer SG.test-key',
        }),
      })
    );
  });

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const result = await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('API error: 401');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should verify connection', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    expect(await provider.verifyConnection()).toBe(true);
  });

  it('should handle verify with 405 (method not allowed)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 405 });
    expect(await provider.verifyConnection()).toBe(true);
  });

  it('should return false on verify failure', async () => {
    mockFetch.mockRejectedValue(new Error('DNS resolution failed'));
    expect(await provider.verifyConnection()).toBe(false);
  });
});
