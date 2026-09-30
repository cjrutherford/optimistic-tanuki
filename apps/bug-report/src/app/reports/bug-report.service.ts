import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { EmailService } from '@optimistic-tanuki/email';
import { NonceService } from '../nonce/nonce.service';
import { SubmitBugReportDto } from './bug-report.dto';
import { GithubService } from './github.service';
import { redact, redactLogs } from './redact.util';

export interface BugReportSubmitResult {
  id: string;
  emailSent: boolean;
  issueUrl: string | null;
}

/**
 * Unauthenticated submit flow: nonce → origin check → redact → email owner + GitHub issue.
 * Never leaks owner email or tokens to the client.
 */
@Injectable()
export class BugReportService {
  private readonly logger = new Logger(BugReportService.name);

  constructor(
    private readonly nonces: NonceService,
    private readonly email: EmailService,
    private readonly github: GithubService,
    private readonly config: ConfigService
  ) {}

  private allowedOrigins(): string[] {
    const raw =
      this.config.get<string>('BUG_REPORT_ALLOWED_ORIGINS') ||
      process.env['BUG_REPORT_ALLOWED_ORIGINS'] ||
      '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async submit(
    dto: SubmitBugReportDto,
    ip: string,
    origin?: string
  ): Promise<BugReportSubmitResult> {
    await this.nonces.consume(dto.nonce, ip);

    const allowed = this.allowedOrigins();
    if (allowed.length > 0 && origin && !allowed.includes(origin)) {
      throw new BadRequestException('origin not allowed');
    }

    const id = randomUUID();
    const description = redact(dto.description, 5000);
    const logs = redactLogs(dto.browserLogs);
    const pageUrl = redact(dto.pageUrl, 2000).slice(0, 2000);
    const traceIds = (dto.backendTraceIds || [])
      .slice(0, 20)
      .map((t) => redact(t, 200));

    const ownerEmail =
      this.config.get<string>('BUG_REPORT_OWNER_EMAIL') ||
      process.env['BUG_REPORT_OWNER_EMAIL'] ||
      '';
    if (!ownerEmail) {
      this.logger.warn('BUG_REPORT_OWNER_EMAIL missing — skipping owner email');
    }

    const title = `[Bug] ${(dto.description || '').slice(0, 80) || pageUrl}`;
    const logBlock = logs
      .map((l) => l.slice(0, 2000))
      .join('\n')
      .slice(0, 30_000);
    const body =
      `**Bug report ${id}**\n\n` +
      `**Page:** ${pageUrl}\n**When:** ${
        dto.occurredAt
      }\n**User-Agent:** ${redact(dto.userAgent, 1000)}\n` +
      (traceIds.length
        ? `**Backend trace ids:** ${traceIds.join(', ')}\n`
        : '') +
      `\n**Description:**\n${description}\n\n` +
      `**Browser logs:**\n\`\`\`\n${logBlock}\n\`\`\`\n\n` +
      `*Screenshot attached inline in owner email (base64 JPEG).*\n`;

    let emailSent = false;
    if (ownerEmail) {
      const html =
        `<h2>Bug report ${id}</h2>` +
        `<table><tr><td>Page</td><td>${this.esc(pageUrl)}</td></tr>` +
        `<tr><td>When</td><td>${this.esc(dto.occurredAt)}</td></tr>` +
        `<tr><td>User-Agent</td><td>${this.esc(
          dto.userAgent.slice(0, 1000)
        )}</td></tr>` +
        (traceIds.length
          ? `<tr><td>Trace ids</td><td>${this.esc(
              traceIds.join(', ')
            )}</td></tr>`
          : '') +
        `</table><h3>Description</h3><p>${this.esc(description)}</p>` +
        `<h3>Screenshot</h3><img src="${dto.screenshotDataUrl}" alt="bug screenshot" style="max-width:100%" />` +
        `<h3>Browser logs</h3><pre>${this.esc(logBlock)}</pre>`;
      try {
        const res = await this.email.sendEmail({
          to: ownerEmail,
          subject: `${title} (${id.slice(0, 8)})`,
          html,
        });
        emailSent = res.success;
        if (!emailSent) this.logger.warn(`Owner email failed: ${res.error}`);
      } catch (err) {
        this.logger.error(
          `Owner email threw: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    const issueUrl = await this.github.createIssue({ title, body });

    return { id, emailSent, issueUrl };
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
