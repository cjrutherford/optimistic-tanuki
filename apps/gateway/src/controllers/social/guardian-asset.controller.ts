import {
  BadGatewayException, Body, Controller, Delete, ForbiddenException,
  Get, HttpException, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, AuthCommands, ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AssetType } from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { AppScope } from '../../decorators/appscope.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { CreateGuardianAssetDto } from './dto/guardian-asset.dto';

@Controller('social/guardian/content/profiles/:profileId/assets')
@UseGuards(AuthGuard)
export class GuardianAssetController {
  constructor(
    @Inject(ServiceTokens.ASSETS_SERVICE) private readonly assets: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly profiles: ClientProxy,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE) private readonly authentication: ClientProxy
  ) {}

  @Post()
  async upload(
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Body() body: CreateGuardianAssetDto,
    @User() user: UserDetails,
    @AppScope() claimedAppScope?: string | null
  ) {
    const actor = await this.assertAccess(profileId, user, claimedAppScope, 'content.manage');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpException('Invalid asset upload', 400);
    const allowed = new Set(['name', 'type', 'content', 'fileExtension']);
    if (Object.keys(body).some((key) => !allowed.has(key))) throw new HttpException('Unsupported guardian asset field', 400);
    if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 255 ||
        /[\\/]/.test(body.name) || [...body.name].some((character) => character.charCodeAt(0) <= 0x1f) ||
        !Object.values(AssetType).includes(body.type)) {
      throw new HttpException('Invalid asset upload', 400);
    }
    if (typeof body.content !== 'string' || body.content.length === 0) throw new HttpException('Asset content is required', 400);
    const base64 = body.content.startsWith('data:') ? body.content.slice(body.content.indexOf(',') + 1) : body.content;
    if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64) ||
        Buffer.from(base64, 'base64').length === 0 || Buffer.from(base64, 'base64').toString('base64') !== base64) {
      throw new HttpException('Invalid asset content', 400);
    }
    if (body.fileExtension !== undefined && (typeof body.fileExtension !== 'string' || !/^\.?[a-zA-Z0-9]{1,10}$/.test(body.fileExtension))) {
      throw new HttpException('Invalid file extension', 400);
    }
    return this.sendAssetCommand({ cmd: AssetCommands.GUARDIAN_CREATE }, {
      ...actor,
      asset: { name: body.name, type: body.type, content: body.content, fileExtension: body.fileExtension, profileId },
    }, 30_000);
  }

  @Get()
  async list(
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Query('type') type: AssetType | undefined,
    @User() user: UserDetails,
    @AppScope() claimedAppScope?: string | null
  ) {
    const actor = await this.assertAccess(profileId, user, claimedAppScope, 'content.view');
    if (type && !Object.values(AssetType).includes(type)) throw new HttpException('Invalid asset type', 400);
    const assets = await this.sendAssetCommand<Array<{ id: string }>>({ cmd: AssetCommands.GUARDIAN_LIST }, { ...actor, type }, 5000);
    return assets.map((asset: { id: string }) => ({ ...asset, url: `/api/asset/${asset.id}` }));
  }

  @Delete(':assetId')
  async remove(
    @Param('profileId', new ParseUUIDPipe()) profileId: string,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @User() user: UserDetails,
    @AppScope() claimedAppScope?: string | null
  ) {
    const actor = await this.assertAccess(profileId, user, claimedAppScope, 'content.manage');
    return this.sendAssetCommand({ cmd: AssetCommands.GUARDIAN_REMOVE }, { ...actor, id: assetId }, 10_000);
  }

  private async sendAssetCommand<T>(pattern: unknown, payload: unknown, timeoutMs: number): Promise<T> {
    try {
      return await firstValueFrom(this.assets.send<T>(pattern, payload).pipe(timeout({ first: timeoutMs })));
    } catch (error) {
      const outer = error as { statusCode?: number; code?: string; error?: { statusCode?: number; code?: string } };
      const detail = outer?.error ?? outer;
      if (detail?.statusCode === 403 && detail.code === 'GUARDIAN_CONTENT_ACCESS_DENIED') {
        throw new ForbiddenException('Guardian asset access denied');
      }
      throw new BadGatewayException('Guardian asset service is unavailable');
    }
  }

  private async assertAccess(profileId: string, user: UserDetails, claimedAppScope: string | null | undefined, operation: 'content.view' | 'content.manage') {
    const appId = user?.appId;
    if (!user?.userId || !profileId || !['client-interface', 'local-hub'].includes(appId ?? '') || (claimedAppScope && claimedAppScope !== appId)) {
      throw new ForbiddenException('Guardian asset access denied');
    }
    const profile = await firstValueFrom(this.profiles.send({ cmd: ProfileCommands.Get }, { id: profileId }).pipe(timeout({ first: 3000 }))) as { id?: string; userId?: string; appScope?: string };
    if (!profile || profile.id !== profileId || !profile.userId || profile.appScope !== appId || profile.userId === user.userId) {
      throw new ForbiddenException('Guardian asset access denied');
    }
    try {
      await firstValueFrom(this.authentication.send({ cmd: AuthCommands.AuthorizeGuardianContentOperation }, {
        actorUserId: user.userId, dependentUserId: profile.userId, appId, operation,
      }).pipe(timeout({ first: 3000 })));
    } catch (error) {
      const nested = error as { statusCode?: number; code?: string; message?: string; error?: { statusCode?: number; code?: string; message?: string } };
      const detail = nested?.error ?? nested;
      if (detail?.statusCode === 403 && detail.code === 'GUARDIAN_CONTENT_ACCESS_DENIED') throw new ForbiddenException('Guardian asset access denied');
      throw new BadGatewayException('Guardian asset authorization is unavailable');
    }
    return { actorUserId: user.userId, targetProfileId: profileId, appId };
  }
}
