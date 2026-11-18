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
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions = ['keep_separate', 'merge', 'undo'];
const states = ['queued', 'kept_separate', 'merged'];
type RequestUser = { user?: { profileId?: string } };

/**
 * Reviewer-only queue of uncertain duplicates (owner decision D13). The weaker listing is hidden when the case is
 * queued; a reviewer keeps the pair separate (the listing returns), merges (it stays hidden) or undoes a decision.
 */
@Controller('directory/towns/:townId/duplicate-cases')
export class DirectoryDuplicateCasesController {
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
    return new ServiceUnavailableException('Duplicate review unavailable');
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

  private text(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length <= max;
  }

  private listing(value: any): { scanId: string; sourceFileRowNumber: string } {
    if (
      !value ||
      !this.text(value.scanId, 64) ||
      !/^[0-9]{1,18}$/.test(String(value.sourceFileRowNumber))
    )
      throw this.unavailable();
    return {
      scanId: value.scanId,
      sourceFileRowNumber: String(value.sourceFileRowNumber),
    };
  }

  private project(result: any): { cases: Record<string, unknown>[] } {
    const rows = result?.cases;
    if (!Array.isArray(rows) || rows.length > 200) throw this.unavailable();
    return {
      cases: rows.map((r: any) => {
        const name = (v: unknown): string | null => {
          if (v === null || v === undefined) return null;
          if (!this.text(v, 300)) throw this.unavailable();
          return v;
        };
        if (
          !r ||
          typeof r.caseId !== 'string' ||
          !uuid.test(r.caseId) ||
          !states.includes(r.state) ||
          !this.text(r.rule, 64) ||
          !this.text(r.weakerBasis, 64) ||
          !Number.isInteger(r.distanceMeters) ||
          !this.text(r.createdAt, 64) ||
          Number.isNaN(Date.parse(r.createdAt))
        )
          throw this.unavailable();
        return {
          caseId: r.caseId,
          state: r.state,
          rule: r.rule,
          weakerBasis: r.weakerBasis,
          distanceMeters: r.distanceMeters,
          kept: this.listing(r.kept),
          hidden: this.listing(r.hidden),
          keptName: name(r.keptName),
          hiddenName: name(r.hiddenName),
          createdAt: r.createdAt,
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
      throw new ConflictException('Duplicate decision refused');
    if (response.status === 404)
      throw new NotFoundException('Duplicate case unavailable');
    if (response.status === 400)
      throw new BadRequestException('Invalid duplicate decision');
    try {
      if (!response.ok) throw Error();
      return await response.json();
    } catch {
      throw this.unavailable();
    }
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('townId') town: string,
    @Req() req: RequestUser
  ): Promise<{ cases: Record<string, unknown>[] }> {
    this.town(town);
    this.reviewer(req);
    const { base, secret } = this.config();
    return this.project(
      await this.send(
        `${base}/internal/local-evaluation/towns/${town}/duplicate-cases`,
        { headers: { authorization: `Bearer ${secret}` } }
      )
    );
  }

  @Post(':caseId/decide')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async decide(
    @Param('townId') town: string,
    @Param('caseId') caseId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ recorded: true; replayed: boolean; state: string }> {
    this.town(town);
    const actorId = this.reviewer(req);
    if (
      !uuid.test(caseId) ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !actions.includes(body.action) ||
      typeof body.reason !== 'string' ||
      !body.reason.trim() ||
      body.reason.length > 1024
    ) {
      throw new BadRequestException('Invalid duplicate decision');
    }
    const { base, secret } = this.config();
    const result = await this.send(
      `${base}/internal/local-evaluation/towns/${town}/duplicate-cases/${caseId}/decide`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: body.action,
          reason: body.reason,
          actorId,
        }),
      }
    );
    if (typeof result?.replayed !== 'boolean' || !states.includes(result.state))
      throw this.unavailable();
    return { recorded: true, replayed: result.replayed, state: result.state };
  }
}
