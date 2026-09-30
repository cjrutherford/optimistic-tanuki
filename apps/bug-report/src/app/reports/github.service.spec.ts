import { ConfigService } from '@nestjs/config';
import { GithubService } from './github.service';

describe('GithubService', () => {
  const make = (env: Record<string, string>, fetchFn?: any) => {
    const config = { get: (k: string) => env[k] } as unknown as ConfigService;
    return new GithubService(config, fetchFn);
  };

  it('returns null when token or repo missing', async () => {
    const svc = make({});
    await expect(
      svc.createIssue({ title: 't', body: 'b' })
    ).resolves.toBeNull();
  });

  it('creates issue with bug labels and truncates long titles', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ html_url: 'https://github.com/o/r/issues/1' }),
    });
    const svc = make(
      { BUG_REPORT_GITHUB_TOKEN: 'tok', BUG_REPORT_GITHUB_REPO: 'o/r' },
      fetchFn
    );
    const url = await svc.createIssue({ title: 'x'.repeat(500), body: 'body' });
    expect(url).toContain('issues/1');
    const [calledUrl, init] = fetchFn.mock.calls[0];
    expect(calledUrl).toContain('/repos/o/r/issues');
    const payload = JSON.parse(init.body);
    expect(payload.labels).toEqual(['bug', 'auto-reported']);
    expect(payload.title.length).toBeLessThanOrEqual(200);
    expect(init.headers.Authorization).toContain('Bearer');
  });

  it('returns null (not throw) when GitHub API fails', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const svc = make(
      { BUG_REPORT_GITHUB_TOKEN: 'tok', BUG_REPORT_GITHUB_REPO: 'o/r' },
      fetchFn
    );
    await expect(
      svc.createIssue({ title: 't', body: 'b' })
    ).resolves.toBeNull();
  });
});
