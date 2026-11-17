import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set([
  'needs_human',
  'auto_approved',
  'approved',
  'published',
  'rejected',
  'revoked',
  'archived',
]);
type RequestUser = { user?: { profileId?: string } };

@Controller('directory/towns/:townId/address-review-candidates')
export class DirectoryAddressReviewController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    ) {
      throw new ServiceUnavailableException('Address review unavailable');
    }
    return { base: base.replace(/\/$/, ''), secret };
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

  private candidate(row: any, town: string): Record<string, unknown> {
    if (
      !row ||
      !uuid.test(row.id || '') ||
      row.communityId !== town ||
      typeof row.name !== 'string' ||
      typeof row.category !== 'string' ||
      typeof row.verdict !== 'string' ||
      typeof row.status !== 'string'
    ) {
      throw new ServiceUnavailableException('Address review unavailable');
    }
    return {
      id: row.id,
      communityId: row.communityId,
      scanId: row.scanId,
      sourceFileRowNumber: row.sourceFileRowNumber,
      name: row.name,
      category: row.category,
      point: row.point,
      addresses: row.addresses,
      websites: row.websites,
      phones: row.phones,
      rights: row.rights,
      risk: row.risk,
      geocode: row.geocode,
      officialEvidence: row.officialEvidence,
      verdict: row.verdict,
      reasons: row.reasons,
      checks: row.checks,
      policyVersion: row.policyVersion,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('townId') town: string,
    @Query('status') status: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Req() req: RequestUser
  ): Promise<{ candidates: Array<Record<string, unknown>> }> {
    this.town(town);
    this.reviewer(req);
    if (status !== undefined && !statuses.has(status)) {
      throw new BadRequestException('Invalid status');
    }
    if (limit !== undefined && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)) {
      throw new BadRequestException('Invalid limit');
    }
    if (
      offset !== undefined &&
      !/^(0|[1-9][0-9]{0,6})$/.test(offset)
    ) {
      throw new BadRequestException('Invalid offset');
    }
    const { base, secret } = this.config();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    try {
      const response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/address-review-candidates?${params}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!Array.isArray(result?.candidates) || result.candidates.length > 100) {
        throw Error();
      }
      return {
        candidates: result.candidates.map((row: any) =>
          this.candidate(row, town)
        ),
      };
    } catch {
      throw new ServiceUnavailableException('Address review unavailable');
    }
  }

  @Post(':candidateId/decisions')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
  @Header('Cache-Control', 'no-store')
  async decide(
    @Param('townId') town: string,
    @Param('candidateId') candidateId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ recorded: true; status: string }> {
    this.town(town);
    if (!uuid.test(candidateId)) {
      throw new BadRequestException('Invalid candidate');
    }
    const reviewerId = this.reviewer(req);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !['approve', 'reject', 'needs_info', 'revoke'].includes(body.decision) ||
      body.attested !== true ||
      (body.evidenceUrl !== undefined &&
        body.evidenceUrl !== '' &&
        (typeof body.evidenceUrl !== 'string' ||
          body.evidenceUrl.length > 2048)) ||
      (body.decision === 'approve' &&
        (typeof body.evidenceUrl !== 'string' || !body.evidenceUrl.trim())) ||
      (body.evidenceHash !== undefined &&
        (typeof body.evidenceHash !== 'string' ||
          !/^[a-f0-9]{64}$/.test(body.evidenceHash))) ||
      (body.reason !== undefined &&
        (typeof body.reason !== 'string' || body.reason.length > 2048)) ||
      (body.checks !== undefined &&
        (!body.checks ||
          typeof body.checks !== 'object' ||
          Array.isArray(body.checks))) ||
      (body.policyVersion !== undefined &&
        (typeof body.policyVersion !== 'string' ||
          body.policyVersion.length > 64))
    ) {
      throw new BadRequestException('Invalid address review');
    }
    const { base, secret } = this.config();
    try {
      const response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/address-review-candidates/${candidateId}/decisions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            actorId: reviewerId,
            decision: body.decision,
            evidenceUrl: body.evidenceUrl,
            evidenceHash: body.evidenceHash,
            reason: body.reason,
            checks: body.checks,
            policyVersion: body.policyVersion,
          }),
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw Error();
      const result = await response.json();
      if (typeof result?.status !== 'string') throw Error();
      return { recorded: true, status: result.status };
    } catch {
      throw new ServiceUnavailableException('Address review unavailable');
    }
  }
}
