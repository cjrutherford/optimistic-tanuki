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
const hex64 = /^[0-9a-f]{64}$/;
const scanIdText = /^[\w.-]{1,64}$/;
const rowNumber = /^[0-9]{1,18}$/;
const healthKeys = [
  'unresolved',
  'absent',
  'awaitingOwner',
  'carryIncomplete',
  'carriedUnbound',
] as const;
const conflictCodes = new Set([
  'stale_decision',
  'not_latest',
  'decision_conflict',
  'invalid_state',
]);
const actions = ['confirm', 'retire', 'merge', 'split'];
type RequestUser = { user?: { profileId?: string } };
type Unavailable = ServiceUnavailableException;

@Controller('directory/towns/:townId/business-identity-review')
export class DirectoryBusinessIdentityReviewController {
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

  private unavailable(): Unavailable {
    return new ServiceUnavailableException(
      'Business identity review unavailable'
    );
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

  private scanId(value: unknown): value is string {
    return (
      typeof value === 'string' && (hex64.test(value) || scanIdText.test(value))
    );
  }

  private rowNumber(value: unknown): value is string {
    return typeof value === 'string' && rowNumber.test(value);
  }

  private versionToken(value: unknown): string {
    if (typeof value !== 'string' || !hex64.test(value)) {
      throw this.unavailable();
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

  private item(r: any, id: string): Record<string, unknown> {
    if (
      !r ||
      r.businessId !== id ||
      typeof r.state !== 'string' ||
      !Array.isArray(r.history) ||
      r.history.length > 500 ||
      !Array.isArray(r.assertions) ||
      r.assertions.length > 500
    ) {
      throw this.unavailable();
    }
    return {
      businessId: r.businessId,
      state: r.state,
      successorId: r.successorId ?? null,
      stateCause: r.stateCause ?? null,
      versionToken: this.versionToken(r.versionToken),
      assertions: r.assertions.map((a: any) => ({
        id: a?.id,
        scanId: a?.scanId,
        sourceFileRowNumber: a?.sourceFileRowNumber,
        confidence: a?.confidence,
        state: a?.state,
      })),
      history: r.history.map((d: any) => {
        if (!d || !this.isUuid(d.decisionId) || typeof d.action !== 'string')
          throw this.unavailable();
        return {
          decisionId: d.decisionId,
          action: d.action,
          businessId: d.businessId,
          otherBusinessId: d.otherBusinessId ?? null,
          actorId: d.actorId,
          actorDomain: d.actorDomain,
          reason: d.reason ?? null,
          createdAt: d.createdAt,
          undoOf: d.undoOf ?? null,
          undoneBy: d.undoneBy ?? null,
          reversible: d.reversible === true,
        };
      }),
    };
  }

  private list<T>(value: unknown, map: (row: any) => T): T[] {
    if (!Array.isArray(value) || value.length > 100) throw this.unavailable();
    return value.map(map);
  }

  private project(result: any): Record<string, unknown> {
    const health = result?.health;
    if (
      !health ||
      typeof health !== 'object' ||
      healthKeys.some((k) => !Number.isInteger(health[k]) || health[k] < 0)
    ) {
      throw this.unavailable();
    }
    const queue = result?.queue;
    if (!queue || typeof queue !== 'object') throw this.unavailable();
    const row = (r: any) => {
      if (
        !r ||
        !this.isUuid(r.businessId) ||
        !this.scanId(r.scanId) ||
        !this.rowNumber(r.sourceFileRowNumber)
      ) {
        throw this.unavailable();
      }
      return {
        businessId: r.businessId,
        scanId: r.scanId,
        sourceFileRowNumber: r.sourceFileRowNumber,
        versionToken: this.versionToken(r.versionToken),
      };
    };
    return {
      health: Object.fromEntries(healthKeys.map((k) => [k, health[k]])),
      queue: {
        carriedUnbound: this.list(queue.carriedUnbound, row),
        unresolved: this.list(queue.unresolved, (r) => {
          if (typeof r?.cause !== 'string' || r.cause.length > 200) {
            throw this.unavailable();
          }
          return { ...row(r), cause: r.cause };
        }),
        awaitingOwner: this.list(queue.awaitingOwner, (r) => {
          if (
            !r ||
            !this.isUuid(r.carryId) ||
            !this.isUuid(r.requestId) ||
            !this.isUuid(r.businessId)
          ) {
            throw this.unavailable();
          }
          return {
            carryId: r.carryId,
            requestId: r.requestId,
            businessId: r.businessId,
            versionToken: this.versionToken(r.versionToken),
          };
        }),
      },
    };
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async queue(
    @Param('townId') town: string,
    @Req() req: RequestUser
  ): Promise<Record<string, unknown>> {
    this.town(town);
    this.reviewer(req);
    const { base, secret } = this.config();
    try {
      const response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-identity-review`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw Error();
      return this.project(await response.json());
    } catch {
      throw this.unavailable();
    }
  }

  @Post('decisions')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async decide(
    @Param('townId') town: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{
    recorded: true;
    replayed: boolean;
    businesses: number;
    restoredLinks: number;
  }> {
    this.town(town);
    const reviewerId = this.reviewer(req);
    const rows = body?.rows;
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      body.attested !== true ||
      !this.isUuid(body.decisionId) ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken) ||
      !actions.includes(body.action) ||
      !this.isUuid(body.businessId) ||
      typeof body.reason !== 'string' ||
      !body.reason.trim() ||
      body.reason.length > 1024 ||
      (body.action === 'merge'
        ? !this.isUuid(body.otherBusinessId) ||
          body.otherBusinessId === body.businessId
        : body.otherBusinessId !== undefined) ||
      (body.action === 'split'
        ? !Array.isArray(rows) ||
          rows.length < 1 ||
          rows.length > 100 ||
          new Set(
            rows.map((r: any) => `${r?.scanId}:${r?.sourceFileRowNumber}`)
          ).size !== rows.length ||
          rows.some(
            (r: any) =>
              !r ||
              typeof r !== 'object' ||
              !this.scanId(r.scanId) ||
              !this.rowNumber(r.sourceFileRowNumber)
          )
        : rows !== undefined)
    ) {
      throw new BadRequestException('Invalid business identity decision');
    }
    const { base, secret } = this.config();
    let response: Response;
    try {
      response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-identity-review/decisions`,
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
            action: body.action,
            businessId: body.businessId,
            otherBusinessId: body.otherBusinessId,
            rows: rows?.map((r: any) => ({
              scanId: r.scanId,
              sourceFileRowNumber: r.sourceFileRowNumber,
            })),
            reason: body.reason,
          }),
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
    } catch {
      throw this.unavailable();
    }
    if (response.status === 409) return this.conflict(response);
    try {
      if (!response.ok) throw Error();
      const result = await response.json();
      if (
        typeof result?.replayed !== 'boolean' ||
        !Number.isInteger(result.businesses) ||
        !Number.isInteger(result.restoredLinks)
      ) {
        throw Error();
      }
      return {
        recorded: true,
        replayed: result.replayed,
        businesses: result.businesses,
        restoredLinks: result.restoredLinks,
      };
    } catch {
      throw this.unavailable();
    }
  }

  @Get(':businessId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async detail(
    @Param('townId') town: string,
    @Param('businessId') businessId: string,
    @Req() req: RequestUser
  ): Promise<Record<string, unknown>> {
    this.town(town);
    if (!this.isUuid(businessId))
      throw new BadRequestException('Invalid business');
    this.reviewer(req);
    const { base, secret } = this.config();
    let response: Response;
    try {
      response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-identity-review/${businessId}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
    } catch {
      throw this.unavailable();
    }
    if (response.status === 404)
      throw new NotFoundException('Business not found');
    try {
      if (!response.ok) throw Error();
      return this.item(await response.json(), businessId);
    } catch {
      throw this.unavailable();
    }
  }

  @Post(':businessId/undo')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async undo(
    @Param('townId') town: string,
    @Param('businessId') businessId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ recorded: true; replayed: boolean }> {
    this.town(town);
    if (!this.isUuid(businessId))
      throw new BadRequestException('Invalid business');
    const reviewerId = this.reviewer(req);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !this.isUuid(body.decisionId) ||
      !this.isUuid(body.undoOf) ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken) ||
      typeof body.reason !== 'string' ||
      !body.reason.trim() ||
      body.reason.length > 1024
    ) {
      throw new BadRequestException('Invalid business identity undo');
    }
    const { base, secret } = this.config();
    let response: Response;
    try {
      response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-identity-review/${businessId}/undo`,
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
    } catch {
      throw this.unavailable();
    }
    if (response.status === 409) return this.conflict(response);
    try {
      if (!response.ok) throw Error();
      const result = await response.json();
      if (typeof result?.replayed !== 'boolean') throw Error();
      return { recorded: true, replayed: result.replayed };
    } catch {
      throw this.unavailable();
    }
  }
}
