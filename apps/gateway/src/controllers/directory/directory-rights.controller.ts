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
import {
  DIRECTORY_PERMISSIONS,
  WITHDRAWAL_CONFIRMATION,
} from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex64 = /^[0-9a-f]{64}$/;
const conflictCodes = new Set([
  'stale_decision',
  'not_latest',
  'decision_conflict',
  'invalid_state',
]);
const caseStatuses = ['review', 'excluded', 'resolved', 'withdrawn'];
const withdrawalStatuses = ['pending', 'running', 'complete', 'failed'];
const decisionActions = ['exclude_field', 'confirm_terms', 'defer', 'reopen'];
const withdrawalKinds = ['scan', 'policy', 'row'];
type RequestUser = { user?: { profileId?: string } };

/**
 * Shared plumbing for the rights operator routes: Directory internal HTTP,
 * actor from the session, machine-coded 409s and nothing else crossing.
 */
abstract class DirectoryRightsBase {
  protected config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Rights unavailable');
    return { base: base.replace(/\/$/, ''), secret };
  }

  protected actor(req: RequestUser): string {
    const id = req.user?.profileId;
    if (!id || !uuid.test(id))
      throw new ForbiddenException('Verified operator required');
    return id;
  }

  protected isUuid(value: unknown): value is string {
    return typeof value === 'string' && uuid.test(value);
  }

  protected text(value: unknown, max = 1024): value is string {
    return typeof value === 'string' && !!value.trim() && value.length <= max;
  }

  protected object(body: unknown): body is Record<string, any> {
    return !!body && typeof body === 'object' && !Array.isArray(body);
  }

  protected page(query: Record<string, unknown>, statuses: string[]): string {
    const out = new URLSearchParams();
    for (const key of Object.keys(query))
      if (!['status', 'limit', 'offset'].includes(key))
        throw new BadRequestException('Invalid query');
    const { status, limit, offset } = query as Record<string, unknown>;
    if (status !== undefined) {
      if (typeof status !== 'string' || !statuses.includes(status))
        throw new BadRequestException('Invalid status');
      out.set('status', status);
    }
    for (const [name, value, max, min] of [
      ['limit', limit, 100, 1],
      ['offset', offset, 1_000_000, 0],
    ] as const) {
      if (value === undefined) continue;
      const n = typeof value === 'string' && /^\d+$/.test(value) ? +value : NaN;
      if (!Number.isSafeInteger(n) || n < min || n > max)
        throw new BadRequestException(`Invalid ${name}`);
      out.set(name, String(n));
    }
    const text = out.toString();
    return text ? `?${text}` : '';
  }

  protected async send(
    path: string,
    init: RequestInit = {}
  ): Promise<Record<string, any>> {
    const { base, secret } = this.config();
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${secret}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
    } catch {
      throw new ServiceUnavailableException('Rights unavailable');
    }
    if (response.status === 409) {
      let code = 'invalid_state';
      try {
        const body = await response.json();
        if (typeof body?.code === 'string' && conflictCodes.has(body.code))
          code = body.code;
      } catch {
        // generic code
      }
      throw new ConflictException({ code, message: 'Decision refused' });
    }
    if (response.status === 404) throw new NotFoundException('Not found');
    if (response.status === 400)
      throw new BadRequestException('Invalid request');
    try {
      if (!response.ok) throw Error();
      return await response.json();
    } catch {
      throw new ServiceUnavailableException('Rights unavailable');
    }
  }

  protected shape(value: unknown, ok: boolean): void {
    if (!ok || !value)
      throw new ServiceUnavailableException('Rights unavailable');
  }

  protected rightsCase(c: any): Record<string, unknown> {
    this.shape(
      c,
      this.isUuid(c?.id) &&
        caseStatuses.includes(c.status) &&
        typeof c.versionToken === 'string' &&
        hex64.test(c.versionToken)
    );
    return c;
  }

  protected withdrawal(w: any): Record<string, unknown> {
    this.shape(
      w,
      this.isUuid(w?.id) &&
        withdrawalKinds.includes(w.kind) &&
        withdrawalStatuses.includes(w.status)
    );
    return w;
  }
}

/**
 * Rights case intake and handling. Requires directory.rights, which is
 * separate from directory.review. A decision here never grants public
 * display; it records evidence or excludes a field from what could be shown.
 */
@Controller('directory/rights-cases')
export class DirectoryRightsCasesController extends DirectoryRightsBase {
  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async list(@Query() query: Record<string, unknown>, @Req() req: RequestUser) {
    this.actor(req);
    const result = await this.send(
      `/internal/rights/cases${this.page(query, caseStatuses)}`
    );
    this.shape(
      result,
      Array.isArray(result.cases) && result.cases.length <= 100
    );
    return { cases: result.cases.map((c: any) => this.rightsCase(c)) };
  }

  @Post('sync')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async sync(@Body() body: any, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !this.object(body) ||
      !this.isUuid(body.syncId) ||
      typeof body.releaseId !== 'string' ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(body.releaseId)
    )
      throw new BadRequestException('Invalid rights sync');
    const result = await this.send('/internal/rights/cases/sync', {
      method: 'POST',
      body: JSON.stringify({
        syncId: body.syncId,
        releaseId: body.releaseId,
        actorId,
      }),
    });
    this.shape(
      result,
      Number.isSafeInteger(result.created) &&
        Number.isSafeInteger(result.existing)
    );
    return {
      created: result.created,
      existing: result.existing,
      lineages: Number.isSafeInteger(result.lineages) ? result.lineages : 0,
    };
  }

  @Get(':caseId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async detail(@Param('caseId') caseId: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(caseId)) throw new BadRequestException('Invalid case');
    const result = await this.send(`/internal/rights/cases/${caseId}`);
    this.rightsCase(result);
    this.shape(
      result,
      Array.isArray(result.history) && result.history.length <= 500
    );
    return result;
  }

  @Post(':caseId/decisions')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async decide(
    @Param('caseId') caseId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !this.isUuid(caseId) ||
      !this.object(body) ||
      !this.isUuid(body.decisionId) ||
      !decisionActions.includes(body.action) ||
      !this.text(body.reason) ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken) ||
      (body.termsUrl !== undefined && !this.text(body.termsUrl, 2048)) ||
      (body.termsSha256 !== undefined &&
        (typeof body.termsSha256 !== 'string' || !hex64.test(body.termsSha256)))
    )
      throw new BadRequestException('Invalid rights decision');
    const result = await this.send(
      `/internal/rights/cases/${caseId}/decisions`,
      {
        method: 'POST',
        body: JSON.stringify({
          decisionId: body.decisionId,
          action: body.action,
          reason: body.reason,
          expectedVersionToken: body.expectedVersionToken,
          ...(body.termsUrl === undefined ? {} : { termsUrl: body.termsUrl }),
          ...(body.termsSha256 === undefined
            ? {}
            : { termsSha256: body.termsSha256 }),
          actorId,
        }),
      }
    );
    this.shape(
      result,
      typeof result.replayed === 'boolean' &&
        caseStatuses.includes(result.status)
    );
    return { recorded: true, replayed: result.replayed, status: result.status };
  }

  @Post(':caseId/undo')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async undo(
    @Param('caseId') caseId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !this.isUuid(caseId) ||
      !this.object(body) ||
      !this.isUuid(body.decisionId) ||
      !this.isUuid(body.undoOf) ||
      !this.text(body.reason) ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken)
    )
      throw new BadRequestException('Invalid rights undo');
    const result = await this.send(`/internal/rights/cases/${caseId}/undo`, {
      method: 'POST',
      body: JSON.stringify({
        decisionId: body.decisionId,
        undoOf: body.undoOf,
        reason: body.reason,
        expectedVersionToken: body.expectedVersionToken,
        actorId,
      }),
    });
    this.shape(
      result,
      typeof result.replayed === 'boolean' &&
        caseStatuses.includes(result.status)
    );
    return { recorded: true, replayed: result.replayed, status: result.status };
  }
}

/**
 * Durable authenticated withdrawal. Creating a request records intent and
 * returns at once; the Directory worker removes the data. Withdrawal is one
 * way: there is no undo and no route that restores withdrawn rows.
 */
@Controller('directory/withdrawals')
export class DirectoryWithdrawalsController extends DirectoryRightsBase {
  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async list(@Query() query: Record<string, unknown>, @Req() req: RequestUser) {
    this.actor(req);
    const result = await this.send(
      `/internal/withdrawals${this.page(query, withdrawalStatuses)}`
    );
    this.shape(
      result,
      Array.isArray(result.requests) && result.requests.length <= 100
    );
    return { requests: result.requests.map((w: any) => this.withdrawal(w)) };
  }

  @Post()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async create(@Body() body: any, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !this.object(body) ||
      !this.isUuid(body.id) ||
      !withdrawalKinds.includes(body.kind) ||
      typeof body.target !== 'string' ||
      !this.text(body.target, 200) ||
      !this.text(body.reason) ||
      body.confirm !== WITHDRAWAL_CONFIRMATION ||
      (body.rightsCaseId !== undefined && !this.isUuid(body.rightsCaseId))
    )
      throw new BadRequestException('Invalid withdrawal');
    const result = await this.send('/internal/withdrawals', {
      method: 'POST',
      body: JSON.stringify({
        id: body.id,
        kind: body.kind,
        target: body.target,
        reason: body.reason,
        confirm: body.confirm,
        ...(body.rightsCaseId === undefined
          ? {}
          : { rightsCaseId: body.rightsCaseId }),
        actorId,
      }),
    });
    this.shape(result, typeof result.replayed === 'boolean');
    return {
      replayed: result.replayed,
      request: this.withdrawal(result.request),
    };
  }

  @Get(':withdrawalId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.rights)
  @Header('Cache-Control', 'no-store')
  async detail(@Param('withdrawalId') id: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(id)) throw new BadRequestException('Invalid withdrawal');
    return this.withdrawal(await this.send(`/internal/withdrawals/${id}`));
  }
}
