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
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex64 = /^[0-9a-f]{64}$/;
const conflictCodes = new Set([
  'stale_decision',
  'not_latest',
  'decision_conflict',
  'invalid_state',
]);
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
      versionToken: this.token(row.versionToken),
    };
  }

  private token(value: unknown): string {
    if (typeof value !== 'string' || !hex64.test(value)) {
      throw new ServiceUnavailableException('Address review unavailable');
    }
    return value;
  }

  /** A 409 from the Directory carries a machine code the Owner Console reacts to; nothing else crosses. */
  private async conflict(response: Response): Promise<never> {
    let code = 'invalid_state';
    try {
      const body = await response.json();
      if (typeof body?.code === 'string' && conflictCodes.has(body.code))
        code = body.code;
    } catch {
      // keep the generic code
    }
    throw new ConflictException({ code, message: 'Decision refused' });
  }

  private history(rows: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(rows) || rows.length > 500) {
      throw new ServiceUnavailableException('Address review unavailable');
    }
    return rows.map((d: any) => {
      if (
        !d ||
        !uuid.test(d.decisionId || '') ||
        typeof d.decision !== 'string'
      )
        throw new ServiceUnavailableException('Address review unavailable');
      return {
        decisionId: d.decisionId,
        actorKind: d.actorKind,
        actorId: d.actorId,
        decision: d.decision,
        reason: d.reason ?? null,
        createdAt: d.createdAt,
        undoOf: d.undoOf ?? null,
        undoneBy: d.undoneBy ?? null,
        reversible: d.reversible === true,
      };
    });
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
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
    if (offset !== undefined && !/^(0|[1-9][0-9]{0,6})$/.test(offset)) {
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
      if (
        !Array.isArray(result?.candidates) ||
        result.candidates.length > 100
      ) {
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
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async decide(
    @Param('townId') town: string,
    @Param('candidateId') candidateId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ recorded: true; status: string; replayed: boolean }> {
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
      !uuid.test(body.decisionId ?? '') ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken) ||
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
            decisionId: body.decisionId,
            expectedVersionToken: body.expectedVersionToken,
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
      if (response.status === 409) return await this.conflict(response);
      if (!response.ok) throw Error();
      const result = await response.json();
      if (typeof result?.status !== 'string') throw Error();
      return {
        recorded: true,
        status: result.status,
        replayed: result.replayed === true,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('Address review unavailable');
    }
  }

  @Get(':candidateId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async detail(
    @Param('townId') town: string,
    @Param('candidateId') candidateId: string,
    @Req() req: RequestUser
  ): Promise<Record<string, unknown>> {
    this.town(town);
    if (!uuid.test(candidateId)) {
      throw new BadRequestException('Invalid candidate');
    }
    this.reviewer(req);
    const { base, secret } = this.config();
    let response: Response;
    try {
      response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/address-review-candidates/${candidateId}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
    } catch {
      throw new ServiceUnavailableException('Address review unavailable');
    }
    if (response.status === 404)
      throw new NotFoundException('Candidate not found');
    try {
      if (!response.ok) throw Error();
      const row = await response.json();
      return {
        ...this.candidate(row, town),
        history: this.history(row.history),
      };
    } catch {
      throw new ServiceUnavailableException('Address review unavailable');
    }
  }

  @Post(':candidateId/undo')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async undo(
    @Param('townId') town: string,
    @Param('candidateId') candidateId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ recorded: true; status: string; replayed: boolean }> {
    this.town(town);
    if (!uuid.test(candidateId)) {
      throw new BadRequestException('Invalid candidate');
    }
    const reviewerId = this.reviewer(req);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !uuid.test(body.decisionId ?? '') ||
      !uuid.test(body.undoOf ?? '') ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken) ||
      typeof body.reason !== 'string' ||
      !body.reason.trim() ||
      body.reason.length > 1024
    ) {
      throw new BadRequestException('Invalid address review undo');
    }
    const { base, secret } = this.config();
    try {
      const response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/address-review-candidates/${candidateId}/undo`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            actorId: reviewerId,
            decisionId: body.decisionId,
            undoOf: body.undoOf,
            expectedVersionToken: body.expectedVersionToken,
            reason: body.reason,
          }),
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (response.status === 409) return await this.conflict(response);
      if (!response.ok) throw Error();
      const result = await response.json();
      if (typeof result?.status !== 'string') throw Error();
      return {
        recorded: true,
        status: result.status,
        replayed: result.replayed === true,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('Address review unavailable');
    }
  }
}
