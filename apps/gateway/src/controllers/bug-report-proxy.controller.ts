import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Unauthenticated proxy to the bug-report microservice.
 * No AuthGuard/PermissionsGuard — security is the single-use nonce.
 * Preserves client IP via X-Forwarded-For so nonce IP-binding works.
 */
@Controller('bug-reports')
export class BugReportProxyController {
  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (
      this.config.get<string>('BUG_REPORT_SERVICE_URL') ||
      process.env['BUG_REPORT_SERVICE_URL'] ||
      'http://localhost:3027'
    ).replace(/\/$/, '');
  }

  @Get('nonce')
  async nonce(@Ip() ip: string, @Headers() headers: Record<string, string>) {
    return this.proxy('GET', '/api/bug-reports/nonce', undefined, ip, headers);
  }

  @Post()
  async submit(
    @Body() body: unknown,
    @Ip() ip: string,
    @Headers() headers: Record<string, string>
  ) {
    return this.proxy('POST', '/api/bug-reports', body, ip, headers);
  }

  private async proxy(
    method: string,
    path: string,
    body: unknown,
    ip: string,
    headers: Record<string, string>
  ) {
    const upstream = `${this.baseUrl()}${path}`;
    try {
      const res = await fetch(upstream, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(headers?.['origin'] ? { origin: headers['origin'] } : {}),
          ...(ip ? { 'X-Forwarded-For': ip } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new BadGatewayException(
          (data as { message?: string })?.message || 'Bug-report service error'
        );
      }
      return data;
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      throw new BadGatewayException(
        `Bug-report service unavailable: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
