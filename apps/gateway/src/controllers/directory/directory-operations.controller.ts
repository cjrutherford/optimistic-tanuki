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
import {
  DIRECTORY_OPERATING_CONTROL_KEYS,
  DIRECTORY_PERMISSIONS,
} from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const controlKeys: readonly string[] = DIRECTORY_OPERATING_CONTROL_KEYS;
type RequestUser = { user?: { profileId?: string } };

/**
 * Operator view of Directory health and the operating controls. Directory
 * owns the numbers and the pause state; this controller authenticates the
 * operator, takes the actor from the session (never the body) and relays.
 */
@Controller('directory/operations')
export class DirectoryOperationsController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Operations unavailable');
    return { base: base.replace(/\/$/, ''), secret };
  }

  private actor(req: RequestUser): string {
    const id = req.user?.profileId;
    if (!id || !uuid.test(id))
      throw new ForbiddenException('Verified operator required');
    return id;
  }

  private async fetchInternal(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const { base, secret } = this.config();
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${secret}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(init.method ? 8000 : 15000),
        redirect: 'error',
      });
    } catch {
      throw new ServiceUnavailableException('Operations unavailable');
    }
    if (response.status === 409) {
      let code = 'stale_version';
      try {
        const body = await response.json();
        if (body?.code === 'stale_version') code = body.code;
      } catch {
        // generic code
      }
      throw new ConflictException({ code, message: 'Control changed' });
    }
    if (response.status === 404) throw new NotFoundException('Not found');
    if (response.status === 400)
      throw new BadRequestException('Invalid request');
    if (!response.ok)
      throw new ServiceUnavailableException('Operations unavailable');
    return response;
  }

  private async json(path: string, init: RequestInit = {}): Promise<any> {
    const response = await this.fetchInternal(path, init);
    try {
      return await response.json();
    } catch {
      throw new ServiceUnavailableException('Operations unavailable');
    }
  }

  @Get('metrics')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async metrics(@Req() req: RequestUser) {
    this.actor(req);
    const result = await this.json('/internal/ops/metrics');
    if (!result || typeof result.generatedAt !== 'string')
      throw new ServiceUnavailableException('Operations unavailable');
    return result;
  }

  @Get('metrics/prometheus')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async prometheus(@Req() req: RequestUser): Promise<string> {
    this.actor(req);
    const response = await this.fetchInternal(
      '/internal/ops/metrics?format=prometheus'
    );
    return response.text();
  }

  @Get('controls')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async controls(@Req() req: RequestUser) {
    this.actor(req);
    const result = await this.json('/internal/ops/controls');
    if (!Array.isArray(result?.controls))
      throw new ServiceUnavailableException('Operations unavailable');
    return { controls: result.controls };
  }

  @Post('controls/:key')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.operate)
  @Header('Cache-Control', 'no-store')
  async setControl(
    @Param('key') key: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    const actorId = this.actor(req);
    if (!controlKeys.includes(key))
      throw new NotFoundException('Unknown control');
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !Object.keys(body).every((k) =>
        ['paused', 'reason', 'expectedVersion'].includes(k)
      ) ||
      typeof body.paused !== 'boolean' ||
      (body.reason !== undefined &&
        body.reason !== null &&
        typeof body.reason !== 'string') ||
      !Number.isSafeInteger(body.expectedVersion) ||
      body.expectedVersion < 0
    )
      throw new BadRequestException('Invalid control update');
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length > 500 || (body.paused && !reason))
      throw new BadRequestException('Invalid control update');
    const result = await this.json(`/internal/ops/controls/${key}`, {
      method: 'POST',
      body: JSON.stringify({
        paused: body.paused,
        reason: reason || null,
        actorId,
        expectedVersion: body.expectedVersion,
      }),
    });
    if (result?.key !== key)
      throw new ServiceUnavailableException('Operations unavailable');
    return result;
  }
}
