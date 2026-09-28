import { redact, redactLogs } from './redact.util';

describe('redact', () => {
  it('redacts emails', () => {
    expect(redact('contact me at a@b.com please')).not.toContain('a@b.com');
    expect(redact('contact me at a@b.com please')).toContain(
      '[REDACTED_EMAIL]'
    );
  });

  it('redacts bearer tokens', () => {
    expect(redact('auth Bearer eyJh.bGc.c2ln here')).toContain(
      'Bearer [REDACTED]'
    );
  });

  it('redacts token assignments', () => {
    expect(redact('token=abc123')).toContain('token=[REDACTED]');
    expect(redact('api_key: secret-value')).toContain('[REDACTED]');
  });

  it('truncates overlong input', () => {
    expect(redact('x'.repeat(5000), 100)).toContain('[truncated]');
  });

  it('redacts log arrays and caps at 200', () => {
    const logs = Array.from(
      { length: 250 },
      (_, i) => `log ${i} user${i}@x.com`
    );
    const out = redactLogs(logs);
    expect(out).toHaveLength(200);
    expect(out[0]).not.toContain('@x.com');
  });
});
