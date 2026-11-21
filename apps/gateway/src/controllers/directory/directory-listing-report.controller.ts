import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  ConflictException,
  ForbiddenException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { randomBytes } from 'node:crypto';
import type {
  CreateListingReportResponse,
  ListingReportReasonCode,
  ListingReportReceiptStatus,
  ListingReportReviewItem,
  ListingReportStatus,
} from '@optimistic-tanuki/social-contracts';
import { Public } from '../../decorators/public.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const receiptShape = /^[A-Za-z0-9_-]{32}$/;
export const LISTING_REPORT_REASONS: readonly ListingReportReasonCode[] = [
  'rights-request',
  'incorrect-details',
  'closed-business',
  'safety',
  'duplicate',
  'other',
];
const statuses: readonly ListingReportStatus[] = [
  'received',
  'under_review',
  'resolved',
  'declined',
];
const actions = ['review', 'decline', 'resolve'];
export const LISTING_REPORT_NOTE_MAX = 1000;
/** Anything larger than this cannot be a valid report; refused before any work. */
const MAX_BODY_BYTES = 4096;
type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: { profileId?: string };
};

const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** Validated with whitelist + forbidNonWhitelisted by the gateway's global pipe. */
export class CreateListingReportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ enum: LISTING_REPORT_REASONS as unknown as string[] })
  @IsIn(LISTING_REPORT_REASONS as unknown as string[])
  reasonCode!: ListingReportReasonCode;

  @ApiPropertyOptional({ maxLength: LISTING_REPORT_NOTE_MAX })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(LISTING_REPORT_NOTE_MAX)
  note?: string;

  @ApiPropertyOptional({ format: 'email', maxLength: 254 })
  @IsOptional()
  @Transform(trimmed)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** Honeypot. Real clients leave it empty. */
  @ApiPropertyOptional({
    maxLength: 512,
    description: 'Honeypot; leave empty.',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(512)
  website?: string;
}

/** Small in-memory fixed-window limiter, scoped to the public report routes. */
export class ReportRateLimiter {
  private readonly hits = new Map<string, { count: number; reset: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now
  ) {}
  /** True when the call is allowed. */
  take(key: string): boolean {
    const t = this.now();
    const hit = this.hits.get(key);
    if (hit && hit.reset > t) {
      hit.count += 1;
      return hit.count <= this.limit;
    }
    if (this.hits.size >= this.maxKeys) {
      for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k);
      if (this.hits.size >= this.maxKeys) return false;
    }
    this.hits.set(key, { count: 1, reset: t + this.windowMs });
    return true;
  }
}

const isPrivatePeer = (peer: string): boolean =>
  /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|::ffff:(127|10|192\.168|172\.(1[6-9]|2\d|3[01]))\.)/i.test(
    peer
  );

/** The socket peer, or, behind a private-network proxy, the last address that proxy appended. */
export function reportClientKey(req: RequestLike): string {
  const peer = req.socket?.remoteAddress ?? req.ip ?? 'unknown';
  const forwarded = req.headers?.['x-forwarded-for'];
  const header = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  if (header && isPrivatePeer(peer)) {
    const last = header.split(',').pop()?.trim();
    if (last && last.length <= 64) return `ip:${last}`;
  }
  return `ip:${peer}`;
}

const unavailable = () =>
  new ServiceUnavailableException('Reports are unavailable right now');

function config(): { base: string; secret: string } {
  const base = process.env.DIRECTORY_INTERNAL_URL;
  const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
    !base ||
    !secret ||
    Buffer.byteLength(secret) < 32
  )
    throw unavailable();
  return { base: base.replace(/\/$/, ''), secret };
}

/** Internal call. Callers map status codes; nothing about the upstream reaches the client. */
async function send(
  url: string,
  init: RequestInit
): Promise<{ status: number; json: any }> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
  } catch {
    throw unavailable();
  }
  let json: any = null;
  try {
    if (response.ok) json = await response.json();
  } catch {
    throw unavailable();
  }
  return { status: response.status, json };
}

/**
 * Anonymous listing reports. No session, no payment, no ownership claim. Filing a report hides nothing; the
 * receipt code is the only handle the reporter gets and the only thing a later lookup accepts.
 */
@Controller('directory')
export class DirectoryListingReportController {
  private readonly createLimit = new ReportRateLimiter(5, 10 * 60_000);
  private readonly lookupLimit = new ReportRateLimiter(60, 10 * 60_000);

  private tooMany(): HttpException {
    return new HttpException(
      'Too many requests. Please try again later.',
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  @Public()
  @Post('towns/:townId/listing-reports')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  async create(
    @Param('townId') town: string,
    @Body() body: CreateListingReportDto,
    @Req() req: RequestLike
  ): Promise<CreateListingReportResponse> {
    if (!uuid.test(town)) throw new BadRequestException('Invalid town');
    const length = Number(req.headers?.['content-length']);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES)
      throw new HttpException(
        'Request too large',
        HttpStatus.PAYLOAD_TOO_LARGE
      );
    if (!this.createLimit.take(reportClientKey(req))) throw this.tooMany();
    // A filled honeypot looks like success but stores and sends nothing.
    if (body.website !== undefined)
      return { receipt: randomBytes(24).toString('base64url') };
    const { base, secret } = config();
    const result = await send(
      `${base}/internal/local-evaluation/towns/${town}/listing-reports`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          listingId: body.listingId,
          reasonCode: body.reasonCode,
          ...(body.note === undefined ? {} : { note: body.note }),
          ...(body.email === undefined ? {} : { email: body.email }),
        }),
      }
    );
    if (result.status === 404)
      throw new NotFoundException('Listing unavailable');
    if (result.status === 400) throw new BadRequestException('Invalid report');
    const receipt = result.json?.receipt;
    if (
      result.status !== 200 ||
      typeof receipt !== 'string' ||
      !receiptShape.test(receipt)
    )
      throw unavailable();
    return { receipt };
  }

  @Public()
  @Get('listing-reports/:receipt')
  @Header('Cache-Control', 'no-store')
  async status(
    @Param('receipt') receipt: string,
    @Req() req: RequestLike
  ): Promise<ListingReportReceiptStatus> {
    if (!this.lookupLimit.take(reportClientKey(req))) throw this.tooMany();
    if (!receiptShape.test(receipt ?? ''))
      throw new NotFoundException('Report not found');
    const { base, secret } = config();
    const result = await send(
      `${base}/internal/local-evaluation/listing-reports/${receipt}`,
      { headers: { authorization: `Bearer ${secret}` } }
    );
    if (result.status === 404) throw new NotFoundException('Report not found');
    const j = result.json;
    if (
      result.status !== 200 ||
      !statuses.includes(j?.status) ||
      !LISTING_REPORT_REASONS.includes(j?.reasonCode) ||
      typeof j?.createdAt !== 'string' ||
      Number.isNaN(Date.parse(j.createdAt))
    )
      throw unavailable();
    return {
      status: j.status,
      reasonCode: j.reasonCode,
      createdAt: j.createdAt,
    };
  }
}

/** Reviewer queue and transitions: Owner Console scope, same guards as listing suppression. */
@Controller('directory/towns/:townId/listing-reports')
export class DirectoryListingReportReviewController {
  private isUuid(value: unknown): value is string {
    return typeof value === 'string' && uuid.test(value);
  }
  private isDate(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }
  private reviewer(req: RequestLike): string {
    const id = req.user?.profileId;
    if (!id || !uuid.test(id))
      throw new ForbiddenException('Verified reviewer required');
    return id;
  }
  private nullableUuid(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (!this.isUuid(value)) throw unavailable();
    return value;
  }
  private nullableText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || value.length > LISTING_REPORT_NOTE_MAX)
      throw unavailable();
    return value;
  }

  private project(result: any): { reports: ListingReportReviewItem[] } {
    const rows = result?.reports;
    if (!Array.isArray(rows) || rows.length > 200) throw unavailable();
    return {
      reports: rows.map((r: any) => {
        if (
          !r ||
          !this.isUuid(r.reportId) ||
          !this.isUuid(r.listingId) ||
          !LISTING_REPORT_REASONS.includes(r.reasonCode) ||
          !statuses.includes(r.status) ||
          typeof r.priority !== 'boolean' ||
          !this.isDate(r.createdAt) ||
          (r.decidedAt !== null &&
            r.decidedAt !== undefined &&
            !this.isDate(r.decidedAt)) ||
          (r.listingName !== null &&
            r.listingName !== undefined &&
            (typeof r.listingName !== 'string' || r.listingName.length > 300))
        )
          throw unavailable();
        // Explicit projection: no other upstream field, and no reporter contact, can pass through.
        return {
          reportId: r.reportId,
          listingId: r.listingId,
          listingName: r.listingName ?? null,
          reasonCode: r.reasonCode,
          note: this.nullableText(r.note),
          status: r.status,
          priority: r.priority,
          createdAt: r.createdAt,
          decidedById: this.nullableUuid(r.decidedById),
          decidedAt: r.decidedAt ?? null,
          decisionNote: this.nullableText(r.decisionNote),
          suppressionId: this.nullableUuid(r.suppressionId),
        };
      }),
    };
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('townId') town: string,
    @Query('status') status?: string
  ): Promise<{ reports: ListingReportReviewItem[] }> {
    if (!uuid.test(town)) throw new BadRequestException('Invalid town');
    if (
      status !== undefined &&
      status !== 'open' &&
      !statuses.includes(status as ListingReportStatus)
    )
      throw new BadRequestException('Invalid status');
    const { base, secret } = config();
    const query =
      status === undefined ? '' : `?status=${encodeURIComponent(status)}`;
    const result = await send(
      `${base}/internal/local-evaluation/towns/${town}/listing-reports${query}`,
      { headers: { authorization: `Bearer ${secret}` } }
    );
    if (result.status !== 200) throw unavailable();
    return this.project(result.json);
  }

  @Post(':reportId/:action')
  @HttpCode(200)
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async transition(
    @Param('townId') town: string,
    @Param('reportId') reportId: string,
    @Param('action') action: string,
    @Body() body: any,
    @Req() req: RequestLike
  ): Promise<{
    recorded: true;
    replayed: boolean;
    reportId: string;
    status: ListingReportStatus;
  }> {
    if (!uuid.test(town)) throw new BadRequestException('Invalid town');
    const actorId = this.reviewer(req);
    const note = body?.note;
    const suppressionId = body?.suppressionId;
    if (
      !this.isUuid(reportId) ||
      !actions.includes(action) ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => !['note', 'suppressionId'].includes(k)) ||
      (note !== undefined &&
        (typeof note !== 'string' ||
          !note.trim() ||
          note.length > LISTING_REPORT_NOTE_MAX)) ||
      (action === 'decline' && note === undefined) ||
      (action === 'review' && note !== undefined) ||
      (suppressionId !== undefined &&
        (action !== 'resolve' || !this.isUuid(suppressionId)))
    )
      throw new BadRequestException('Invalid report action');
    const { base, secret } = config();
    const result = await send(
      `${base}/internal/local-evaluation/towns/${town}/listing-reports/${reportId}/${action}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          actorId,
          ...(note === undefined ? {} : { note }),
          ...(suppressionId === undefined ? {} : { suppressionId }),
        }),
      }
    );
    if (result.status === 409)
      throw new ConflictException('Report action refused');
    if (result.status === 404) throw new NotFoundException('Report not found');
    if (result.status === 400)
      throw new BadRequestException('Invalid report action');
    const j = result.json;
    if (
      result.status !== 200 ||
      typeof j?.replayed !== 'boolean' ||
      !this.isUuid(j.reportId) ||
      !statuses.includes(j.status)
    )
      throw unavailable();
    return {
      recorded: true,
      replayed: j.replayed,
      reportId: j.reportId,
      status: j.status,
    };
  }
}
