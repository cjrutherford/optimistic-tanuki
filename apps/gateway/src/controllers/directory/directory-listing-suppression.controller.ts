import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const suppressionReasons = [
  'rights-request',
  'incorrect-details',
  'closed-business',
  'safety',
  'duplicate',
  'other',
];
const liftReasons = ['resolved', 'mistaken-suppression', 'other'];
type RequestUser = { user?: { profileId?: string } };

/**
 * Reviewer-only per-listing suppression. A correction is a suppression with
 * the incorrect-details reason: the listing is hidden and sent back to review;
 * corrected values are never accepted or copied here.
 */
@Controller('directory/towns/:townId/listing-suppressions')
export class DirectoryListingSuppressionController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    ) {
      throw this.unavailable();
    }
    return { base: base.replace(/\/$/, ''), secret };
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException('Listing suppression unavailable');
  }

  private town(value: string): void {
    if (!uuid.test(value)) throw new BadRequestException('Invalid town');
  }

  private reviewer(req: RequestUser): string {
    const reviewerId = req.user?.profileId;
    if (!reviewerId || !uuid.test(reviewerId)) {
      throw new ForbiddenException('Verified reviewer required');
    }
    return reviewerId;
  }

  private isUuid(value: unknown): value is string {
    return typeof value === 'string' && uuid.test(value);
  }

  private isDate(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }

  private nullableUuid(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (!this.isUuid(value)) throw this.unavailable();
    return value;
  }

  private project(result: any): { suppressions: Record<string, unknown>[] } {
    const rows = result?.suppressions;
    if (!Array.isArray(rows) || rows.length > 200) throw this.unavailable();
    return {
      suppressions: rows.map((r: any) => {
        if (
          !r ||
          !this.isUuid(r.suppressionId) ||
          !this.isUuid(r.listingId) ||
          !suppressionReasons.includes(r.reasonCode) ||
          !this.isDate(r.createdAt) ||
          (r.listingName !== null &&
            r.listingName !== undefined &&
            (typeof r.listingName !== 'string' ||
              r.listingName.length > 300)) ||
          (r.note !== null &&
            r.note !== undefined &&
            (typeof r.note !== 'string' || r.note.length > 1024)) ||
          (r.liftedAt !== null &&
            r.liftedAt !== undefined &&
            !this.isDate(r.liftedAt)) ||
          (r.liftReasonCode !== null &&
            r.liftReasonCode !== undefined &&
            !liftReasons.includes(r.liftReasonCode))
        ) {
          throw this.unavailable();
        }
        return {
          suppressionId: r.suppressionId,
          listingId: r.listingId,
          listingName: r.listingName ?? null,
          reasonCode: r.reasonCode,
          note: r.note ?? null,
          actorId: this.nullableUuid(r.actorId),
          createdAt: r.createdAt,
          liftedAt: r.liftedAt ?? null,
          liftReasonCode: r.liftReasonCode ?? null,
          liftedById: this.nullableUuid(r.liftedById),
        };
      }),
    };
  }

  private async send(
    url: string,
    init: RequestInit
  ): Promise<Record<string, any>> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
    } catch {
      throw this.unavailable();
    }
    if (response.status === 409)
      throw new ConflictException('Suppression refused');
    if (response.status === 404)
      throw new NotFoundException('Listing unavailable');
    try {
      if (!response.ok) throw Error();
      return await response.json();
    } catch {
      throw this.unavailable();
    }
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('townId') town: string,
    @Req() req: RequestUser
  ): Promise<{ suppressions: Record<string, unknown>[] }> {
    this.town(town);
    this.reviewer(req);
    const { base, secret } = this.config();
    return this.project(
      await this.send(
        `${base}/internal/local-evaluation/towns/${town}/listing-suppressions`,
        { headers: { authorization: `Bearer ${secret}` } }
      )
    );
  }

  @Post()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
  @Header('Cache-Control', 'no-store')
  async suppress(
    @Param('townId') town: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{
    recorded: true;
    replayed: boolean;
    suppressionId: string;
    reasonCode: string;
    sentToReview: boolean;
  }> {
    this.town(town);
    const actorId = this.reviewer(req);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      body.attested !== true ||
      !this.isUuid(body.suppressionId) ||
      !this.isUuid(body.listingId) ||
      !suppressionReasons.includes(body.reasonCode) ||
      (body.note !== undefined &&
        (typeof body.note !== 'string' ||
          !body.note.trim() ||
          body.note.length > 1024))
    ) {
      throw new BadRequestException('Invalid listing suppression');
    }
    const { base, secret } = this.config();
    const result = await this.send(
      `${base}/internal/local-evaluation/towns/${town}/listing-suppressions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          suppressionId: body.suppressionId,
          listingId: body.listingId,
          reasonCode: body.reasonCode,
          ...(body.note === undefined ? {} : { note: body.note }),
          actorId,
        }),
      }
    );
    if (
      typeof result?.replayed !== 'boolean' ||
      typeof result.sentToReview !== 'boolean' ||
      !this.isUuid(result.suppressionId) ||
      !suppressionReasons.includes(result.reasonCode)
    ) {
      throw this.unavailable();
    }
    return {
      recorded: true,
      replayed: result.replayed,
      suppressionId: result.suppressionId,
      reasonCode: result.reasonCode,
      sentToReview: result.sentToReview,
    };
  }

  @Post(':suppressionId/lift')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
  @Header('Cache-Control', 'no-store')
  async lift(
    @Param('townId') town: string,
    @Param('suppressionId') suppressionId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{
    recorded: true;
    replayed: boolean;
    suppressionId: string;
    liftReasonCode: string;
  }> {
    this.town(town);
    const actorId = this.reviewer(req);
    if (
      !this.isUuid(suppressionId) ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      body.attested !== true ||
      !liftReasons.includes(body.reasonCode)
    ) {
      throw new BadRequestException('Invalid listing suppression');
    }
    const { base, secret } = this.config();
    const result = await this.send(
      `${base}/internal/local-evaluation/towns/${town}/listing-suppressions/${suppressionId}/lift`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reasonCode: body.reasonCode, actorId }),
      }
    );
    if (
      typeof result?.replayed !== 'boolean' ||
      !this.isUuid(result.suppressionId) ||
      !liftReasons.includes(result.liftReasonCode)
    ) {
      throw this.unavailable();
    }
    return {
      recorded: true,
      replayed: result.replayed,
      suppressionId: result.suppressionId,
      liftReasonCode: result.liftReasonCode,
    };
  }
}
