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
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const conflictDetails = new Set([
  'already_locked',
  'no_verified_boundary',
  'not_locked',
  'job_running',
]);
type RequestUser = { user?: { profileId?: string } };

/**
 * Operator routes for the reviewed-binding queue, the owner boundary lock and
 * guarded maintenance jobs. Directory owns every rule; this controller
 * authenticates, takes the actor from the session (never the body), checks the
 * shape and relays over the internal route.
 */
@Controller('directory')
export class DirectoryAdminController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Directory unavailable');
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

  private text(value: unknown): value is string {
    return typeof value === 'string' && !!value.trim() && value.length <= 1024;
  }

  private strict(
    body: unknown,
    allowed: string[]
  ): body is Record<string, unknown> {
    return (
      !!body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      Object.keys(body).every((k) => allowed.includes(k))
    );
  }

  private shape(ok: boolean): void {
    if (!ok) throw new ServiceUnavailableException('Directory unavailable');
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
        signal: AbortSignal.timeout(init.method ? 15000 : 8000),
        redirect: 'error',
      });
    } catch {
      throw new ServiceUnavailableException('Directory unavailable');
    }
    if (response.status === 409) {
      let detail: string | undefined;
      try {
        const body = await response.json();
        if (
          typeof body?.detail === 'string' &&
          conflictDetails.has(body.detail)
        )
          detail = body.detail;
      } catch {
        // generic conflict
      }
      throw new ConflictException({
        code: 'invalid_state',
        message: 'Action refused',
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
      throw new ServiceUnavailableException('Directory unavailable');
    }
  }

  private post(path: string, body: Record<string, unknown>) {
    return this.send(path, { method: 'POST', body: JSON.stringify(body) });
  }

  // ---- reviewed bindings --------------------------------------------------------------------------------------

  @Get('reviewed-bindings')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List reviewed bindings by state',
    description:
      'Only state=suspended is supported. Newest suspension first, keyset-paged with limit (1-100) and cursor; total counts every match.',
  })
  async bindings(
    @Query() query: Record<string, unknown>,
    @Req() req: RequestUser
  ) {
    this.actor(req);
    const out = new URLSearchParams();
    for (const key of Object.keys(query))
      if (!['state', 'townId', 'limit', 'cursor'].includes(key))
        throw new BadRequestException('Invalid query');
    const { state, townId, limit, cursor } = query;
    if (state !== undefined && state !== 'suspended')
      throw new BadRequestException('Invalid state');
    out.set('state', 'suspended');
    if (townId !== undefined) {
      if (!this.isUuid(townId)) throw new BadRequestException('Invalid town');
      out.set('townId', townId);
    }
    if (limit !== undefined) {
      const n =
        typeof limit === 'string' && /^\d+$/.test(limit) ? Number(limit) : NaN;
      if (!Number.isSafeInteger(n) || n < 1 || n > 100)
        throw new BadRequestException('Invalid limit');
      out.set('limit', String(n));
    }
    if (cursor !== undefined) {
      if (typeof cursor !== 'string' || !cursor || cursor.length > 512)
        throw new BadRequestException('Invalid cursor');
      out.set('cursor', cursor);
    }
    const result = await this.send(
      `/internal/reviewed-bindings?${out.toString()}`
    );
    this.shape(
      Array.isArray(result['bindings']) &&
        result['bindings'].length <= 100 &&
        typeof result['total'] === 'number'
    );
    return result;
  }

  @Post('reviewed-bindings/:id/revalidate')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Revalidate one reviewed binding against its source',
    description:
      'Runs the same revalidation the sweep uses and returns the resulting state. 503 when the source stage is not configured.',
  })
  async revalidate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (!this.isUuid(id) || (body !== undefined && !this.strict(body, [])))
      throw new BadRequestException('Invalid binding');
    const result = await this.post(
      `/internal/reviewed-bindings/${id}/revalidate`,
      { actorId }
    );
    this.shape(
      result['bindingId'] === id && typeof result['outcome'] === 'string'
    );
    return result;
  }

  // ---- owner boundary lock ------------------------------------------------------------------------------------

  @Get('towns/:townId/boundary-lock')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read whether a town boundary is locked' })
  async lockState(@Param('townId') townId: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(townId)) throw new BadRequestException('Invalid town');
    const result = await this.send(`/internal/towns/${townId}/boundary-lock`);
    this.shape(typeof result['locked'] === 'boolean');
    return result;
  }

  @Post('towns/:townId/boundary-lock')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Lock the boundary a town serves now',
    description:
      'Needs a reason and a verified current boundary. 409 detail already_locked or no_verified_boundary. Recovery keeps the lock.',
  })
  async lock(
    @Param('townId') townId: string,
    @Body() body: unknown,
    @Req() req: RequestUser
  ) {
    return this.lockAction('boundary-lock', townId, body, req);
  }

  @Post('towns/:townId/boundary-unlock')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Unlock a town boundary and return it to boundary review',
    description:
      'Needs a reason. 409 detail not_locked when there is no lock. Recovery does not recreate a lock that was removed.',
  })
  async unlock(
    @Param('townId') townId: string,
    @Body() body: unknown,
    @Req() req: RequestUser
  ) {
    return this.lockAction('boundary-unlock', townId, body, req);
  }

  private async lockAction(
    action: 'boundary-lock' | 'boundary-unlock',
    townId: string,
    body: unknown,
    req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (
      !this.isUuid(townId) ||
      !this.strict(body, ['reason']) ||
      !this.text(body['reason'])
    )
      throw new BadRequestException('Invalid boundary lock request');
    const result = await this.post(`/internal/towns/${townId}/${action}`, {
      actorId,
      reason: body['reason'].trim(),
    });
    this.shape(typeof result['locked'] === 'boolean');
    return result;
  }

  // ---- jobs ---------------------------------------------------------------------------------------------------

  @Post('jobs/renormalize')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Start a re-normalize job',
    description:
      'townId is optional; dryRun defaults to true. A real run (dryRun false) needs a reason. One job runs at a time (409 detail job_running). Poll GET jobs/{id}; job state is in memory and does not survive a Directory restart.',
  })
  async startRenormalize(@Body() body: unknown, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !this.strict(body, ['townId', 'dryRun', 'reason']) ||
      (body['townId'] !== undefined && !this.isUuid(body['townId'])) ||
      (body['dryRun'] !== undefined && typeof body['dryRun'] !== 'boolean') ||
      (body['reason'] !== undefined && !this.text(body['reason'])) ||
      (body['dryRun'] === false && !this.text(body['reason']))
    )
      throw new BadRequestException('Invalid job');
    const result = await this.post('/internal/jobs/renormalize', {
      actorId,
      ...(body['townId'] ? { townId: body['townId'] } : {}),
      dryRun: body['dryRun'] ?? true,
      ...(typeof body['reason'] === 'string'
        ? { reason: body['reason'].trim() }
        : {}),
    });
    this.shape(
      this.isUuid(result['id']) && typeof result['status'] === 'string'
    );
    return result;
  }

  @Get('jobs/:id')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read a maintenance job status and counts' })
  async job(@Param('id') id: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(id)) throw new BadRequestException('Invalid job');
    const result = await this.send(`/internal/jobs/${id}`);
    this.shape(result['id'] === id && typeof result['status'] === 'string');
    return result;
  }
}
