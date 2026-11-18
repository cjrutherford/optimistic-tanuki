import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  GoneException,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import {
  DIRECTORY_EXPORT_STATUSES,
  DIRECTORY_PERMISSIONS,
} from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const releasePattern = /^[A-Za-z0-9._-]{1,100}$/;
const conflictCodes = new Set([
  'idempotency_mismatch',
  'invalid_state',
  'not_ready',
]);
const statuses: readonly string[] = DIRECTORY_EXPORT_STATUSES;
type RequestUser = { user?: { profileId?: string } };
interface ResponseHeaders {
  setHeader(name: string, value: string): unknown;
}

/**
 * Operator export of directory rows. Directory decides what may leave (the
 * independent export grant, the field allowlist); this controller only
 * authenticates the operator, forwards the request and streams the finished
 * artifact through without buffering it.
 */
@Controller('directory/exports')
export class DirectoryExportsController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Exports unavailable');
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

  private page(query: Record<string, unknown>): string {
    const out = new URLSearchParams();
    for (const key of Object.keys(query))
      if (!['status', 'limit', 'offset'].includes(key))
        throw new BadRequestException('Invalid query');
    const { status, limit, offset } = query;
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

  private async conflict(response: Response): Promise<never> {
    let code = 'invalid_state';
    try {
      const body = await response.json();
      if (typeof body?.code === 'string' && conflictCodes.has(body.code))
        code = body.code;
    } catch {
      // generic code
    }
    throw new ConflictException({ code, message: 'Export refused' });
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
      throw new ServiceUnavailableException('Exports unavailable');
    }
    if (response.status === 409) await this.conflict(response);
    if (response.status === 410) throw new GoneException('Export is gone');
    if (response.status === 404) throw new NotFoundException('Not found');
    if (response.status === 400)
      throw new BadRequestException('Invalid request');
    if (!response.ok)
      throw new ServiceUnavailableException('Exports unavailable');
    return response;
  }

  private async send(
    path: string,
    init: RequestInit = {}
  ): Promise<Record<string, any>> {
    const response = await this.fetchInternal(path, init);
    try {
      return await response.json();
    } catch {
      throw new ServiceUnavailableException('Exports unavailable');
    }
  }

  private job(value: any): Record<string, unknown> {
    if (!this.isUuid(value?.id) || !statuses.includes(value.status))
      throw new ServiceUnavailableException('Exports unavailable');
    return value;
  }

  @Post()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.export)
  @Header('Cache-Control', 'no-store')
  async create(@Body() body: any, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !this.isUuid(body.id) ||
      typeof body.releaseId !== 'string' ||
      !releasePattern.test(body.releaseId) ||
      (body.communityId !== undefined && !this.isUuid(body.communityId))
    )
      throw new BadRequestException('Invalid export request');
    const result = await this.send('/internal/exports', {
      method: 'POST',
      body: JSON.stringify({
        id: body.id,
        actorId,
        releaseId: body.releaseId,
        ...(body.communityId === undefined
          ? {}
          : { communityId: body.communityId }),
      }),
    });
    return this.job(result);
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.export)
  @Header('Cache-Control', 'no-store')
  async list(@Query() query: Record<string, unknown>, @Req() req: RequestUser) {
    this.actor(req);
    const result = await this.send(`/internal/exports${this.page(query)}`);
    if (
      !Array.isArray(result['items']) ||
      result['items'].length > 100 ||
      !Number.isSafeInteger(result['total'])
    )
      throw new ServiceUnavailableException('Exports unavailable');
    return {
      items: result['items'].map((j: unknown) => this.job(j)),
      total: result['total'],
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.export)
  @Header('Cache-Control', 'no-store')
  async detail(@Param('id') id: string, @Req() req: RequestUser) {
    this.actor(req);
    if (!this.isUuid(id)) throw new BadRequestException('Invalid export');
    return this.job(await this.send(`/internal/exports/${id}`));
  }

  @Post(':id/retry')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.export)
  @Header('Cache-Control', 'no-store')
  async retry(@Param('id') id: string, @Req() req: RequestUser) {
    const actorId = this.actor(req);
    if (!this.isUuid(id)) throw new BadRequestException('Invalid export');
    return this.job(
      await this.send(`/internal/exports/${id}/retry`, {
        method: 'POST',
        body: JSON.stringify({ actorId }),
      })
    );
  }

  @Get(':id/artifact')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.export)
  @Header('Cache-Control', 'no-store')
  async artifact(
    @Param('id') id: string,
    @Req() req: RequestUser,
    @Res({ passthrough: true }) res: ResponseHeaders
  ): Promise<StreamableFile> {
    const actorId = this.actor(req);
    if (!this.isUuid(id)) throw new BadRequestException('Invalid export');
    const response = await this.fetchInternal(
      `/internal/exports/${id}/artifact?actorId=${actorId}`
    );
    const sha = response.headers.get('x-content-sha256');
    if (!response.body || !sha || !/^[0-9a-f]{64}$/.test(sha)) {
      await response.body?.cancel().catch(() => undefined);
      throw new ServiceUnavailableException('Exports unavailable');
    }
    res.setHeader(
      'content-type',
      response.headers.get('content-type') ?? 'application/x-ndjson'
    );
    res.setHeader('x-content-sha256', sha);
    const disposition = response.headers.get('content-disposition');
    if (disposition) res.setHeader('content-disposition', disposition);
    res.setHeader('cache-control', 'no-store');
    return new StreamableFile(
      Readable.fromWeb(response.body as unknown as WebReadableStream)
    );
  }
}
