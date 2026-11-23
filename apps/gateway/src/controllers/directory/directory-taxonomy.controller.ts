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
import { ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import {
  DIRECTORY_PERMISSIONS,
  TAXONOMY_APPLY_CONFIRMATION,
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
const caseStatuses = ['open', 'assigned', 'rejected', 'deferred', 'dismissed'];
const decisionActions = ['assign', 'reject', 'defer', 'reopen'];
const conflictDetails = new Set(['unmapped_policy_excludes']);
const id100 = /^[A-Za-z0-9._-]{1,100}$/;
export const TAXONOMY_ROLLBACK_CONFIRMATION = 'ROLLBACK';
type RequestUser = { user?: { profileId?: string } };

/**
 * Taxonomy operator routes. Directory internal HTTP, actor from the session,
 * machine-coded 409s, and only checked shapes crossing back. Everything needs
 * directory.operate; the Directory runtime owns the rules.
 */
@Controller('directory/taxonomy')
export class DirectoryTaxonomyController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Taxonomy unavailable');
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
    if (!ok) throw new ServiceUnavailableException('Taxonomy unavailable');
  }

  private page(query: Record<string, unknown>, filters: string[]): string {
    const out = new URLSearchParams();
    for (const key of Object.keys(query))
      if (!['limit', 'offset', ...filters].includes(key))
        throw new BadRequestException('Invalid query');
    const { status, townId, limit, offset } = query as Record<string, unknown>;
    if (status !== undefined) {
      if (
        !filters.includes('status') ||
        typeof status !== 'string' ||
        !caseStatuses.includes(status)
      )
        throw new BadRequestException('Invalid status');
      out.set('status', status);
    }
    if (townId !== undefined) {
      if (!filters.includes('townId') || !this.isUuid(townId))
        throw new BadRequestException('Invalid town');
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
      throw new ServiceUnavailableException('Taxonomy unavailable');
    }
    if (response.status === 409) {
      let code = 'invalid_state';
      let detail: string | undefined;
      try {
        const body = await response.json();
        if (typeof body?.code === 'string' && conflictCodes.has(body.code))
          code = body.code;
        if (
          typeof body?.detail === 'string' &&
          conflictDetails.has(body.detail)
        )
          detail = body.detail;
      } catch {
        // generic code
      }
      throw new ConflictException({
        code,
        message: 'Decision refused',
        ...(detail ? { detail } : {}),
      });
    }
    if (response.status === 404) throw new NotFoundException('Not found');
    if (response.status === 400)
      throw new BadRequestException('Invalid request');
    try {
      if (!response.ok) throw Error();
      return await response.json();
    } catch {
      throw new ServiceUnavailableException('Taxonomy unavailable');
    }
  }

  private post(path: string, body: Record<string, unknown>) {
    return this.send(path, { method: 'POST', body: JSON.stringify(body) });
  }

  private taxonomyCase(c: any): Record<string, unknown> {
    this.shape(
      !!c &&
        this.isUuid(c.id) &&
        caseStatuses.includes(c.status) &&
        typeof c.versionToken === 'string' &&
        hex64.test(c.versionToken)
    );
    return c;
  }

  private run(r: any): Record<string, unknown> {
    this.shape(
      !!r &&
        this.isUuid(r.id) &&
        typeof r.status === 'string' &&
        (r.mode === 'dry_run' || r.mode === 'apply')
    );
    return r;
  }

  // ---- mappings -----------------------------------------------------------------------------------------------

  @Get('mappings')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async mappings(
    @Query() query: Record<string, unknown>,
    @Req() req: RequestUser
  ) {
    this.actor(req);
    if (Object.keys(query).length)
      throw new BadRequestException('Invalid query');
    const result = await this.send('/internal/taxonomy/mappings');
    this.shape(
      Array.isArray(result.versions) && Array.isArray(result.available)
    );
    return result;
  }

  @Post('mappings/install')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async install(@Body() body: any, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !this.object(body) ||
      typeof body.version !== 'string' ||
      !id100.test(body.version) ||
      typeof body.activate !== 'boolean'
    )
      throw new BadRequestException('Invalid mapping install');
    const result = await this.post('/internal/taxonomy/mappings/install', {
      version: body.version,
      activate: body.activate,
      actorId,
    });
    this.shape(typeof result.replayed === 'boolean' && !!result.version);
    return result;
  }

  @Post('mappings/:versionId/deactivate')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Deactivate a taxonomy mapping version',
    description:
      'Needs a reason. Refused with 409 detail unmapped_policy_excludes when it is the active version and its unmappedPolicy would exclude listings.',
  })
  async deactivate(
    @Param('versionId') versionId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !id100.test(versionId) ||
      !this.object(body) ||
      Object.keys(body).some((k) => k !== 'reason') ||
      !this.text(body.reason)
    )
      throw new BadRequestException('Invalid mapping deactivation');
    const result = await this.post(
      `/internal/taxonomy/mappings/${versionId}/deactivate`,
      { actorId, reason: body.reason.trim() }
    );
    this.shape(typeof result.replayed === 'boolean' && !!result.version);
    return result;
  }

  @Post('mappings/:versionId/activate')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Activate an installed taxonomy mapping version',
    description:
      'Same rules as install with activate set; an optional reason is recorded in the audit.',
  })
  async activate(
    @Param('versionId') versionId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !id100.test(versionId) ||
      (body !== undefined && body !== null && !this.object(body)) ||
      Object.keys(body ?? {}).some((k) => k !== 'reason') ||
      (body?.reason !== undefined && !this.text(body.reason))
    )
      throw new BadRequestException('Invalid mapping activation');
    const result = await this.post(
      `/internal/taxonomy/mappings/${versionId}/activate`,
      { actorId, ...(body?.reason ? { reason: body.reason.trim() } : {}) }
    );
    this.shape(typeof result.replayed === 'boolean' && !!result.version);
    return result;
  }

  // ---- cases --------------------------------------------------------------------------------------------------

  @Get('cases')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async cases(
    @Query() query: Record<string, unknown>,
    @Req() req: RequestUser
  ) {
    this.actor(req);
    const result = await this.send(
      `/internal/taxonomy/cases${this.page(query, ['status', 'townId'])}`
    );
    this.shape(Array.isArray(result.cases) && result.cases.length <= 100);
    return { cases: result.cases.map((c: any) => this.taxonomyCase(c)) };
  }

  @Post('cases')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async raise(@Body() body: any, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !this.object(body) ||
      !this.isUuid(body.caseId) ||
      !this.isUuid(body.townId) ||
      !this.isUuid(body.listingId) ||
      !this.text(body.reason)
    )
      throw new BadRequestException('Invalid taxonomy case');
    const result = await this.post('/internal/taxonomy/cases', {
      caseId: body.caseId,
      townId: body.townId,
      listingId: body.listingId,
      reason: body.reason,
      actorId,
    });
    this.shape(typeof result.replayed === 'boolean');
    return { replayed: result.replayed, case: this.taxonomyCase(result.case) };
  }

  @Get('cases/:caseId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async caseDetail(@Param('caseId') caseId: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(caseId)) throw new BadRequestException('Invalid case');
    const result = await this.send(`/internal/taxonomy/cases/${caseId}`);
    this.taxonomyCase(result);
    this.shape(Array.isArray(result.history) && result.history.length <= 500);
    return result;
  }

  @Post('cases/:caseId/decisions')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
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
      (body.action === 'assign') !== (body.categoryId !== undefined) ||
      (body.categoryId !== undefined &&
        (typeof body.categoryId !== 'string' ||
          !id100.test(body.categoryId))) ||
      (body.placeTypeId !== undefined &&
        (body.action !== 'assign' ||
          typeof body.placeTypeId !== 'string' ||
          !id100.test(body.placeTypeId)))
    )
      throw new BadRequestException('Invalid taxonomy decision');
    const result = await this.post(
      `/internal/taxonomy/cases/${caseId}/decisions`,
      {
        decisionId: body.decisionId,
        action: body.action,
        reason: body.reason,
        expectedVersionToken: body.expectedVersionToken,
        ...(body.categoryId === undefined
          ? {}
          : { categoryId: body.categoryId }),
        ...(body.placeTypeId === undefined
          ? {}
          : { placeTypeId: body.placeTypeId }),
        actorId,
      }
    );
    this.shape(
      typeof result.replayed === 'boolean' &&
        caseStatuses.includes(result.status)
    );
    return { recorded: true, replayed: result.replayed, status: result.status };
  }

  @Post('cases/:caseId/dismiss')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async dismiss(
    @Param('caseId') caseId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !this.isUuid(caseId) ||
      !this.object(body) ||
      !this.isUuid(body.decisionId) ||
      !this.text(body.reason) ||
      typeof body.expectedVersionToken !== 'string' ||
      !hex64.test(body.expectedVersionToken)
    )
      throw new BadRequestException('Invalid taxonomy dismissal');
    const result = await this.post(
      `/internal/taxonomy/cases/${caseId}/dismiss`,
      {
        decisionId: body.decisionId,
        reason: body.reason,
        expectedVersionToken: body.expectedVersionToken,
        actorId,
      }
    );
    this.shape(
      typeof result.replayed === 'boolean' &&
        caseStatuses.includes(result.status)
    );
    return { recorded: true, replayed: result.replayed, status: result.status };
  }

  @Post('cases/:caseId/undo')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
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
      throw new BadRequestException('Invalid taxonomy undo');
    const result = await this.post(`/internal/taxonomy/cases/${caseId}/undo`, {
      decisionId: body.decisionId,
      undoOf: body.undoOf,
      reason: body.reason,
      expectedVersionToken: body.expectedVersionToken,
      actorId,
    });
    this.shape(
      typeof result.replayed === 'boolean' &&
        caseStatuses.includes(result.status)
    );
    return { recorded: true, replayed: result.replayed, status: result.status };
  }

  // ---- runs ---------------------------------------------------------------------------------------------------

  @Get('runs')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async runs(@Query() query: Record<string, unknown>, @Req() req: RequestUser) {
    this.actor(req);
    const result = await this.send(
      `/internal/taxonomy/runs${this.page(query, [])}`
    );
    this.shape(Array.isArray(result.runs) && result.runs.length <= 100);
    return { runs: result.runs.map((r: any) => this.run(r)) };
  }

  @Post('runs')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async createRun(@Body() body: any, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !this.object(body) ||
      !this.isUuid(body.id) ||
      typeof body.mappingVersion !== 'string' ||
      !id100.test(body.mappingVersion) ||
      !['town', 'all'].includes(body.scope) ||
      (body.scope === 'town') !== (body.townId !== undefined) ||
      (body.townId !== undefined && !this.isUuid(body.townId)) ||
      !['dry_run', 'apply'].includes(body.mode) ||
      !this.text(body.reason) ||
      (body.mode === 'apply' &&
        (typeof body.expectedPlanHash !== 'string' ||
          !hex64.test(body.expectedPlanHash) ||
          body.confirm !== TAXONOMY_APPLY_CONFIRMATION)) ||
      (body.mode === 'dry_run' &&
        (body.expectedPlanHash !== undefined || body.confirm !== undefined))
    )
      throw new BadRequestException('Invalid taxonomy run');
    const result = await this.post('/internal/taxonomy/runs', {
      id: body.id,
      mappingVersion: body.mappingVersion,
      scope: body.scope,
      ...(body.townId === undefined ? {} : { townId: body.townId }),
      mode: body.mode,
      reason: body.reason,
      ...(body.mode === 'apply'
        ? { expectedPlanHash: body.expectedPlanHash, confirm: body.confirm }
        : {}),
      actorId,
    });
    this.shape(typeof result.replayed === 'boolean');
    return { replayed: result.replayed, run: this.run(result.run) };
  }

  @Get('runs/:runId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async runDetail(@Param('runId') runId: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(runId)) throw new BadRequestException('Invalid run');
    return this.run(await this.send(`/internal/taxonomy/runs/${runId}`));
  }

  @Post('runs/:runId/cancel')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async cancelRun(
    @Param('runId') runId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (!this.isUuid(runId) || !this.object(body) || !this.text(body.reason))
      throw new BadRequestException('Invalid taxonomy cancel');
    const result = await this.post(`/internal/taxonomy/runs/${runId}/cancel`, {
      reason: body.reason,
      actorId,
    });
    this.shape(typeof result.replayed === 'boolean');
    return { replayed: result.replayed, run: this.run(result.run) };
  }

  @Post('runs/:runId/rollback')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async rollbackRun(
    @Param('runId') runId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !this.isUuid(runId) ||
      !this.object(body) ||
      !this.text(body.reason) ||
      body.confirm !== TAXONOMY_ROLLBACK_CONFIRMATION
    )
      throw new BadRequestException('Invalid taxonomy rollback');
    const result = await this.post(
      `/internal/taxonomy/runs/${runId}/rollback`,
      { reason: body.reason, confirm: body.confirm, actorId }
    );
    this.shape(typeof result.replayed === 'boolean');
    return { replayed: result.replayed, run: this.run(result.run) };
  }
}
