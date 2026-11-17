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
const unit = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const conflictCodes = new Set([
  'stale_decision',
  'not_latest',
  'decision_conflict',
  'invalid_state',
  'run_blocked',
]);
const blockedReasons = new Set([
  'policy_blocked',
  'unconfigured_provider',
  'budget_exhausted',
  'quota_exhausted',
  'invalid_geometry',
  'acquisition_unauthorized',
]);
const runStatuses = [
  'queued',
  'running',
  'succeeded',
  'succeeded_empty',
  'partial',
  'blocked',
  'failed_retryable',
  'failed_permanent',
  'cancel_requested',
  'cancelled',
];
const confirmations: Record<string, string> = {
  cancel: 'CANCEL',
  resume: 'RESUME',
  retry: 'RETRY',
};
type RequestUser = { user?: { profileId?: string } };

/**
 * Acquisition run operator routes (S7e). Directory internal HTTP, actor from the session, machine-coded 409s
 * (a blocked run carries its reason), and only checked shapes crossing back. Everything needs directory.operate.
 * The runs themselves are written by local stage scripts; these routes observe them and record operator requests.
 */
@Controller('directory/runs')
export class DirectoryRunsController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Runs unavailable');
    return { base: base.replace(/\/$/, ''), secret };
  }

  private actor(req: RequestUser): string {
    const id = req.user?.profileId;
    if (!id || !uuid.test(id))
      throw new ForbiddenException('Verified operator required');
    return id;
  }

  private isUuid(value: unknown): value is string {
    return typeof value === 'string' && uuid.test(value);
  }

  private text(value: unknown, max = 1024): value is string {
    return typeof value === 'string' && !!value.trim() && value.length <= max;
  }

  private object(body: unknown): body is Record<string, any> {
    return !!body && typeof body === 'object' && !Array.isArray(body);
  }

  private shape(ok: boolean): void {
    if (!ok) throw new ServiceUnavailableException('Runs unavailable');
  }

  private page(query: Record<string, unknown>): string {
    const out = new URLSearchParams();
    for (const key of Object.keys(query))
      if (!['status', 'townId', 'limit', 'offset'].includes(key))
        throw new BadRequestException('Invalid query');
    const { status, townId, limit, offset } = query;
    if (status !== undefined) {
      if (typeof status !== 'string' || !runStatuses.includes(status))
        throw new BadRequestException('Invalid status');
      out.set('status', status);
    }
    if (townId !== undefined) {
      if (!this.isUuid(townId)) throw new BadRequestException('Invalid town');
      out.set('townId', townId);
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

  private async send(
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
      throw new ServiceUnavailableException('Runs unavailable');
    }
    if (response.status === 409) {
      let code = 'invalid_state';
      let reason: string | undefined;
      try {
        const body = await response.json();
        if (typeof body?.code === 'string' && conflictCodes.has(body.code))
          code = body.code;
        if (typeof body?.reason === 'string' && blockedReasons.has(body.reason))
          reason = body.reason;
      } catch {
        // generic code
      }
      throw new ConflictException({
        code,
        ...(reason ? { reason } : {}),
        message: 'Request refused',
      });
    }
    if (response.status === 404) throw new NotFoundException('Not found');
    if (response.status === 400)
      throw new BadRequestException('Invalid request');
    try {
      if (!response.ok) throw Error();
      return await response.json();
    } catch {
      throw new ServiceUnavailableException('Runs unavailable');
    }
  }

  private post(path: string, body: Record<string, unknown>) {
    return this.send(path, { method: 'POST', body: JSON.stringify(body) });
  }

  private summary(r: any): Record<string, unknown> {
    this.shape(
      !!r &&
        this.isUuid(r.id) &&
        typeof r.status === 'string' &&
        runStatuses.includes(r.status) &&
        typeof r.kind === 'string' &&
        (r.blockedReason === null || blockedReasons.has(r.blockedReason))
    );
    return r;
  }

  private detail(r: any): Record<string, unknown> {
    this.summary(r);
    this.shape(
      Array.isArray(r.jobs) &&
        Array.isArray(r.events) &&
        typeof r.versionToken === 'string' &&
        hex64.test(r.versionToken)
    );
    return r;
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async list(@Query() query: Record<string, unknown>, @Req() req: RequestUser) {
    this.actor(req);
    const result = await this.send(
      `/internal/acquisition/runs${this.page(query)}`
    );
    this.shape(Array.isArray(result.runs) && result.runs.length <= 100);
    return {
      runs: result.runs.map((r: any) => this.summary(r)),
      total: Number.isSafeInteger(result.total) ? result.total : 0,
    };
  }

  @Get('latest')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async latest(@Req() req: RequestUser) {
    this.actor(req);
    return this.detail(await this.send('/internal/acquisition/runs/latest'));
  }

  @Get('budget')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async budget(
    @Query() query: Record<string, unknown>,
    @Req() req: RequestUser
  ) {
    this.actor(req);
    if (Object.keys(query).length)
      throw new BadRequestException('Invalid query');
    const result = await this.send('/internal/acquisition/budget');
    this.shape(
      typeof result.period === 'string' &&
        Number.isSafeInteger(result.ceilingCents) &&
        Number.isSafeInteger(result.reservedCents) &&
        Number.isSafeInteger(result.usedCents) &&
        typeof result.hardStop === 'boolean' &&
        typeof result.acquisitionAuthorized === 'boolean'
    );
    return result;
  }

  @Post('history/import')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async importHistory(@Body() body: any, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !this.object(body) ||
      !this.isUuid(body.decisionId) ||
      !this.text(body.reason) ||
      Object.keys(body).some((k) => !['decisionId', 'reason'].includes(k))
    )
      throw new BadRequestException('Invalid history import');
    const result = await this.post('/internal/acquisition/history/import', {
      decisionId: body.decisionId,
      reason: body.reason,
      actorId,
    });
    this.shape(
      typeof result.replayed === 'boolean' &&
        Number.isSafeInteger(result.created) &&
        Number.isSafeInteger(result.existing)
    );
    return {
      replayed: result.replayed,
      created: result.created,
      existing: result.existing,
    };
  }

  @Get(':runId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async runDetail(@Param('runId') runId: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(runId)) throw new BadRequestException('Invalid run');
    return this.detail(await this.send(`/internal/acquisition/runs/${runId}`));
  }

  private async act(
    action: 'cancel' | 'resume' | 'retry',
    runId: string,
    body: any,
    req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !this.isUuid(runId) ||
      !this.object(body) ||
      !this.isUuid(body.decisionId) ||
      !this.text(body.reason) ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken) ||
      body.confirm !== confirmations[action] ||
      (action === 'retry') !== (body.unitKey !== undefined) ||
      (body.unitKey !== undefined &&
        (typeof body.unitKey !== 'string' || !unit.test(body.unitKey))) ||
      Object.keys(body).some(
        (k) =>
          ![
            'decisionId',
            'reason',
            'expectedVersionToken',
            'unitKey',
            'confirm',
          ].includes(k)
      )
    )
      throw new BadRequestException(`Invalid run ${action}`);
    const result = await this.post(
      `/internal/acquisition/runs/${runId}/${action}`,
      {
        decisionId: body.decisionId,
        reason: body.reason,
        expectedVersionToken: body.expectedVersionToken,
        confirm: body.confirm,
        ...(body.unitKey === undefined ? {} : { unitKey: body.unitKey }),
        actorId,
      }
    );
    this.shape(
      typeof result.replayed === 'boolean' &&
        (result.resumeCommand === null ||
          result.resumeCommand === undefined ||
          typeof result.resumeCommand === 'string')
    );
    return {
      replayed: result.replayed,
      run: this.detail(result.run),
      resumeCommand: result.resumeCommand ?? null,
    };
  }

  @Post(':runId/cancel')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  cancel(
    @Param('runId') runId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    return this.act('cancel', runId, body, req);
  }

  @Post(':runId/resume')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  resume(
    @Param('runId') runId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    return this.act('resume', runId, body, req);
  }

  @Post(':runId/retry')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  retry(
    @Param('runId') runId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    return this.act('retry', runId, body, req);
  }
}
