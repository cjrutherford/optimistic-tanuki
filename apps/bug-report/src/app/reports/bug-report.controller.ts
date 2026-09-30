import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NonceService } from '../nonce/nonce.service';
import { SubmitBugReportDto } from './bug-report.dto';
import { BugReportService } from './bug-report.service';

/**
 * Public (unauthenticated) bug-report endpoints.
 * Security: single-use nonce + per-IP throttling + origin allowlist (in service).
 */
@Controller('api/bug-reports')
export class BugReportController {
  constructor(
    private readonly nonces: NonceService,
    private readonly reports: BugReportService
  ) {}

  @Get('nonce')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  getNonce(@Ip() ip: string) {
    return this.nonces.issue(ip || 'unknown');
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  submit(
    @Body() dto: SubmitBugReportDto,
    @Ip() ip: string,
    @Headers('origin') origin?: string
  ) {
    return this.reports.submit(dto, ip || 'unknown', origin);
  }
}
