import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateBugIssueArgs {
  title: string;
  body: string;
}

type FetchFn = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/**
 * Opens issues in a single central repo: BUG_REPORT_GITHUB_REPO=owner/repo.
 * Auth: BUG_REPORT_GITHUB_TOKEN (server-only, never exposed to client).
 * Uses fetch (Node 22 global) to avoid ESM-only Octokit/Jest transform issues.
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly fetchFn?: FetchFn
  ) {}

  private fetchImpl(): FetchFn {
    if (this.fetchFn) return this.fetchFn;
    return (globalThis.fetch as unknown as FetchFn).bind(globalThis);
  }

  parseRepo(): { owner: string; repo: string } | null {
    const raw =
      this.config.get<string>('BUG_REPORT_GITHUB_REPO') ||
      process.env['BUG_REPORT_GITHUB_REPO'] ||
      '';
    const [owner, repo] = raw.split('/');
    if (!owner || !repo) return null;
    return { owner, repo };
  }

  private token(): string {
    return (
      this.config.get<string>('BUG_REPORT_GITHUB_TOKEN') ||
      process.env['BUG_REPORT_GITHUB_TOKEN'] ||
      ''
    );
  }

  async createIssue(args: CreateBugIssueArgs): Promise<string | null> {
    const token = this.token();
    const repo = this.parseRepo();
    if (!token || !repo) {
      this.logger.warn('GitHub token/repo missing — skipping issue creation');
      return null;
    }
    try {
      const res = await this.fetchImpl()(
        `https://api.github.com/repos/${repo.owner}/${repo.repo}/issues`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            title: args.title.slice(0, 200),
            body: args.body.slice(0, 60_000),
            labels: ['bug', 'auto-reported'],
          }),
        }
      );
      if (!res.ok) {
        this.logger.error(`GitHub issue creation failed: HTTP ${res.status}`);
        return null;
      }
      const data = await res.json();
      return (data?.html_url as string) ?? null;
    } catch (err) {
      this.logger.error(
        `GitHub issue creation failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return null; // email path still succeeds; report partial success
    }
  }
}
