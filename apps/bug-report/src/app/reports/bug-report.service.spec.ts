import { ConfigService } from '@nestjs/config';
import { NonceService } from '../nonce/nonce.service';
import { BugReportService } from './bug-report.service';
import { GithubService } from './github.service';

const dto = (nonce: string) => ({
  nonce,
  description: 'Login button does nothing. Contact me at user@example.com',
  pageUrl: 'https://app.example.com/login',
  userAgent: 'jest-agent',
  browserLogs: ['console error: boom', 'token=secret123'],
  backendTraceIds: ['req-abc'],
  screenshotDataUrl: 'data:image/jpeg;base64,/9j/',
  occurredAt: new Date().toISOString(),
});

describe('BugReportService', () => {
  it('consumes nonce, redacts PII, emails owner and opens issue', async () => {
    const nonces = new NonceService();
    const { nonce } = await nonces.issue('5.5.5.5');
    const email = { sendEmail: jest.fn().mockResolvedValue({ success: true }) };
    const github = {
      createIssue: jest
        .fn()
        .mockResolvedValue('https://github.com/o/r/issues/7'),
    };
    const config = {
      get: (k: string) =>
        ({
          BUG_REPORT_OWNER_EMAIL: 'owner@example.com',
          BUG_REPORT_ALLOWED_ORIGINS: '',
        }[k]),
    } as unknown as ConfigService;
    const svc = new BugReportService(
      nonces,
      email as any,
      github as unknown as GithubService,
      config
    );

    const res = await svc.submit(dto(nonce) as any, '5.5.5.5', undefined);
    expect(res.emailSent).toBe(true);
    expect(res.issueUrl).toContain('issues/7');

    const html = email.sendEmail.mock.calls[0][0].html as string;
    expect(html).not.toContain('user@example.com');
    expect(html).not.toContain('secret123');
    expect(html).toContain('data:image/jpeg;base64,/9j/');

    const body = github.createIssue.mock.calls[0][0].body as string;
    expect(body).not.toContain('user@example.com');
  });

  it('rejects origin not on allowlist (nonce still consumed)', async () => {
    const nonces = new NonceService();
    const { nonce } = await nonces.issue('6.6.6.6');
    const config = {
      get: (k: string) =>
        ({
          BUG_REPORT_OWNER_EMAIL: 'owner@example.com',
          BUG_REPORT_ALLOWED_ORIGINS: 'https://allowed.example.com',
        }[k]),
    } as unknown as ConfigService;
    const svc = new BugReportService(
      nonces,
      { sendEmail: jest.fn() } as any,
      { createIssue: jest.fn() } as unknown as GithubService,
      config
    );
    await expect(
      svc.submit(dto(nonce) as any, '6.6.6.6', 'https://evil.example.com')
    ).rejects.toThrow(/origin/i);
    // single-use: second attempt fails on nonce, not origin
    await expect(
      svc.submit(dto(nonce) as any, '6.6.6.6', 'https://allowed.example.com')
    ).rejects.toThrow(/nonce/i);
  });
});
