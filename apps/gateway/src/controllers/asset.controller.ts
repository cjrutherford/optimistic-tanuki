import {
  Body,
  BadGatewayException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  Inject,
  Headers,
  NotFoundException,
  Optional,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  AssetCommands,
  ClassifiedCommands,
  CommunityCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AssetListQuery,
  AssetType,
  CreateAssetDto,
} from '@optimistic-tanuki/models';
import { Response } from 'express';
import { firstValueFrom, timeout } from 'rxjs';
import { Readable } from 'node:stream';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { AuthGuard } from '../auth/auth.guard';
import { LongRunning } from '../decorators/request-timeout.decorator';
import { Public } from '../decorators/public.decorator';
import { User, UserDetails } from '../decorators/user.decorator';
import { AppScope } from '../decorators/appscope.decorator';
import { createHmac } from 'node:crypto';

@Controller('asset')
export class AssetController {
  constructor(
    @Inject(ServiceTokens.ASSETS_SERVICE)
    private readonly assetService: ClientProxy,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialService?: ClientProxy,
    @Optional()
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileService?: ClientProxy,
    @Optional()
    @Inject(ServiceTokens.CLASSIFIEDS_SERVICE)
    private readonly classifiedsService?: ClientProxy
  ) {}

  private toHttpException(
    error: unknown,
    fallbackMessage: string
  ): HttpException {
    const messageSource = error as {
      message?: string;
      error?: { message?: string; statusCode?: number; errors?: string[] };
      statusCode?: number;
      errors?: string[];
    };
    const nestedError = messageSource?.error;
    const statusCode =
      nestedError?.statusCode ?? messageSource?.statusCode ?? 500;
    const message =
      nestedError?.message ?? messageSource?.message ?? fallbackMessage;
    const errors = nestedError?.errors ?? messageSource?.errors;

    return new HttpException(
      errors ? { message, errors } : { message },
      statusCode
    );
  }

  @RequirePermissions('asset.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('/')
  async createAsset(
    @Body() asset: CreateAssetDto,
    @User() user: UserDetails,
    @AppScope() appScope: string | null
  ) {
    try {
      if (!user?.userId || !user.profileId || !asset.profileId) {
        throw new ForbiddenException('Authenticated asset owner is required');
      }
      // sourcePath is reserved for trusted service-to-service video imports.
      // Exposing it through this public HTTP boundary would let a caller ask
      // the assets process to read arbitrary local files and publish them.
      if (asset.sourcePath) {
        throw new HttpException(
          'sourcePath is not accepted by HTTP uploads',
          400
        );
      }
      const profile = await firstValueFrom(
        this.assetProfileRequest(asset.profileId)
      );
      if (profile?.userId !== user.userId) {
        throw new ForbiddenException(
          'Asset profile is not owned by this session'
        );
      }
      if (asset.communityId) {
        const audience = await this.assertUploadAudience(
          asset.communityId,
          appScope,
          user.userId,
          asset.profileId,
          asset.classifiedAdId
        );
        asset = {
          ...asset,
          profileId: asset.profileId,
          ...(audience.isPrivate
            ? { communityId: audience.id }
            : { communityId: undefined }),
          classifiedAdId: undefined,
        };
      }
      return await firstValueFrom(
        this.assetService.send({ cmd: AssetCommands.CREATE }, asset)
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.toHttpException(error, 'Failed to create asset');
    }
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('/:id')
  @RequirePermissions('asset.delete')
  async deleteAsset(@Param('id') id: string, @User() user: UserDetails) {
    try {
      const asset = (await firstValueFrom(
        this.assetService
          .send({ cmd: AssetCommands.RETRIEVE }, { id })
          .pipe(timeout({ first: 5000 }))
      )) as { profileId?: string };
      if (!user?.userId || !asset.profileId) {
        throw new NotFoundException('Asset not found');
      }
      await this.assertProfileOwned(asset.profileId, user);
      return await firstValueFrom(
        this.assetService.send({ cmd: AssetCommands.REMOVE }, { id })
      );
    } catch (error) {
      throw this.toHttpException(error, 'Failed to delete asset');
    }
  }

  @Public()
  @UseGuards(AuthGuard)
  @Get('/:id')
  @LongRunning()
  async getAssetById(
    @Param('id') id: string,
    @Res() res: Response,
    @Headers('range') range?: string,
    @User() user?: UserDetails
  ) {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const asset = (await firstValueFrom(
        this.assetService
          .send({ cmd: AssetCommands.RETRIEVE }, { id })
          .pipe(timeout({ first: 5000 }))
      )) as { profileId?: string; audienceCommunityIds?: string[] };
      const storedAudienceCommunityIds = new Set(
        Array.isArray(asset.audienceCommunityIds)
          ? asset.audienceCommunityIds
          : []
      );
      const legacyAudiences = await this.getLegacyPrivateAudiences(
        id,
        asset.profileId
      );
      if (legacyAudiences.length) {
        await Promise.all(
          legacyAudiences.map((audience) =>
            firstValueFrom(
              this.assetService
                .send(
                  { cmd: AssetCommands.ADD_COMMUNITY_AUDIENCE },
                  { id, communityId: audience.communityId }
                )
                .pipe(timeout({ first: 5000 }))
            )
          )
        );
      }
      const restrictedCommunityIds = new Set(
        legacyAudiences.map((audience) => audience.communityId)
      );
      for (const communityId of storedAudienceCommunityIds) {
        const community = await this.findCommunity(communityId);
        if (!community) throw new NotFoundException('Asset not found');
        if (community.isPrivate) restrictedCommunityIds.add(communityId);
      }
      if (restrictedCommunityIds.size > 0) {
        if (!user?.userId || !user.profileId) {
          throw new NotFoundException('Asset not found');
        }
        const assetOwner =
          user.profileId === asset.profileId ||
          (await this.isProfileOwnedByUser(asset.profileId, user.userId));
        for (const communityId of restrictedCommunityIds) {
          const legacyOwner = legacyAudiences.some(
            (audience) =>
              audience.communityId === communityId &&
              audience.ownerProfileId === user.profileId
          );
          if (!assetOwner && !legacyOwner) {
            const community = await this.findCommunity(communityId);
            if (!community) {
              throw new NotFoundException('Asset not found');
            }
            if (community.isPrivate) {
              const isMember = await this.isCommunityMember(
                communityId,
                user.userId
              );
              if (!isMember) {
                throw new NotFoundException('Asset not found');
              }
            }
          }
        }
      }
      const mediaUrl = this.configService.get<string>(
        'ASSETS_INTERNAL_MEDIA_URL'
      );
      const mediaToken = this.configService.get<string>(
        'ASSETS_INTERNAL_MEDIA_TOKEN'
      );

      if (!mediaUrl || !mediaToken) {
        throw new HttpException(
          {
            message: 'Internal media streaming is unavailable',
            code: 'media-unconfigured',
          },
          502
        );
      }

      const headers: Record<string, string> = {
        'X-Internal-Media-Token': mediaToken,
      };
      if (
        restrictedCommunityIds.size > 0 ||
        storedAudienceCommunityIds.size > 0
      ) {
        const timestamp = String(Date.now());
        const viewerProfile = user?.profileId || 'public';
        headers['X-Internal-Media-Viewer'] = viewerProfile;
        headers['X-Internal-Media-Timestamp'] = timestamp;
        headers['X-Internal-Media-Signature'] = this.signViewerAssertion(
          id,
          viewerProfile,
          timestamp,
          mediaToken
        );
      }
      if (range) {
        headers['Range'] = range;
      }

      const upstream = await fetch(
        `${mediaUrl.replace(/\/$/, '')}/internal/media/${encodeURIComponent(
          id
        )}`,
        { headers }
      );

      for (const [header, responseHeader] of [
        ['accept-ranges', 'Accept-Ranges'],
        ['content-length', 'Content-Length'],
        ['content-range', 'Content-Range'],
        ['content-type', 'Content-Type'],
      ]) {
        const value = upstream.headers.get(header);
        if (value) {
          res.setHeader(responseHeader, value);
        }
      }
      res.status(upstream.status);

      if (!upstream.body) {
        return res.end();
      }

      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException(
        `Failed to stream asset: ${this.errorMessage(error)}`
      );
    }
  }

  private errorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown asset error';
  }

  @RequirePermissions('asset.read')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('/')
  async listAssets(
    @Query('profileId') profileId: string,
    @Query('type') type: AssetType | undefined,
    @User() user: UserDetails
  ) {
    await this.assertProfileOwned(profileId, user);
    const assets = await firstValueFrom(
      this.assetService.send({ cmd: AssetCommands.LIST }, {
        profileId,
        type,
      } as AssetListQuery)
    );
    return assets.map((asset: { id: string }) => ({
      ...asset,
      url: `/api/asset/${asset.id}`,
    }));
  }

  private assetProfileRequest(profileId: string) {
    if (!this.profileService) {
      throw new BadGatewayException('Profile ownership cannot be verified');
    }
    return this.profileService
      .send<{ userId?: string }>(
        { cmd: ProfileCommands.Get },
        { id: profileId }
      )
      .pipe(timeout({ first: 5000 }));
  }

  private async assertProfileOwned(
    profileId: string,
    user: UserDetails
  ): Promise<void> {
    if (!profileId || !user?.userId) {
      throw new ForbiddenException('Authenticated asset profile is required');
    }
    const profile = await firstValueFrom(this.assetProfileRequest(profileId));
    if (profile?.userId !== user.userId) {
      throw new NotFoundException('Assets not found');
    }
  }

  private async isProfileOwnedByUser(
    profileId: string | undefined,
    userId: string
  ): Promise<boolean> {
    if (!profileId) return false;
    const profile = await firstValueFrom(this.assetProfileRequest(profileId));
    return profile?.userId === userId;
  }

  private async assertUploadAudience(
    communityId: string,
    appScope: string | null,
    userId: string,
    profileId: string,
    classifiedId?: string
  ): Promise<{ id: string; appScope: string; isPrivate: boolean }> {
    if (!appScope || !this.socialService) {
      throw new BadGatewayException('Community audience cannot be verified');
    }
    const community = await firstValueFrom(
      this.socialService
        .send<{
          id: string;
          appScope?: string;
          isPrivate?: boolean;
        }>({ cmd: CommunityCommands.FIND }, { id: communityId })
        .pipe(timeout({ first: 5000 }))
    );
    if (
      !community ||
      community.id !== communityId ||
      community.appScope !== appScope
    ) {
      throw new NotFoundException('Community not found in this app');
    }
    if (!(await this.isCommunityMember(communityId, userId))) {
      if (
        !classifiedId ||
        !(await this.ownsClassifiedUploadContext(
          classifiedId,
          communityId,
          appScope,
          userId,
          profileId
        ))
      ) {
        throw new ForbiddenException(
          'Community membership is required for this upload'
        );
      }
    }
    return {
      id: community.id,
      appScope: community.appScope,
      isPrivate: community.isPrivate === true,
    };
  }

  private async ownsClassifiedUploadContext(
    classifiedId: string,
    communityId: string,
    appScope: string,
    userId: string,
    profileId: string
  ): Promise<boolean> {
    if (!this.classifiedsService) {
      throw new BadGatewayException('Classified ownership cannot be verified');
    }
    const classified = await firstValueFrom(
      this.classifiedsService
        .send<{
          id: string;
          communityId?: string;
          userId?: string;
          profileId?: string;
          appScope?: string;
        }>(
          { cmd: ClassifiedCommands.FIND_BY_ID },
          { id: classifiedId, appScope, requestingUserId: userId }
        )
        .pipe(timeout({ first: 5000 }))
    );
    return (
      classified?.id === classifiedId &&
      classified.communityId === communityId &&
      classified.appScope === appScope &&
      classified.userId === userId &&
      classified.profileId === profileId
    );
  }

  private async findCommunity(communityId: string): Promise<
    | {
        id: string;
        appScope?: string;
        isPrivate?: boolean;
      }
    | undefined
  > {
    if (!this.socialService) {
      throw new BadGatewayException('Community audience cannot be verified');
    }
    const community = await firstValueFrom(
      this.socialService
        .send<{ id: string; appScope?: string; isPrivate?: boolean }>(
          { cmd: CommunityCommands.FIND },
          { id: communityId }
        )
        .pipe(timeout({ first: 5000 }))
    );
    return community?.id === communityId ? community : undefined;
  }

  private async isCommunityMember(
    communityId: string,
    userId: string
  ): Promise<boolean> {
    if (!this.socialService) {
      throw new BadGatewayException('Community membership cannot be verified');
    }
    return (
      (await firstValueFrom(
        this.socialService
          .send<boolean>(
            { cmd: 'IS_COMMUNITY_MEMBER' },
            { communityId, userId }
          )
          .pipe(timeout({ first: 5000 }))
      )) === true
    );
  }

  private async getLegacyPrivateAudiences(
    assetId: string,
    assetOwnerProfileId?: string
  ): Promise<Array<{ communityId: string; ownerProfileId: string }>> {
    if (!this.classifiedsService) {
      throw new BadGatewayException(
        'Classified asset audience cannot be verified'
      );
    }
    const references = await firstValueFrom(
      this.classifiedsService
        .send<
          Array<{
            communityId: string;
            appScope: string;
            ownerProfileId: string;
          }>
        >({ cmd: ClassifiedCommands.FIND_ASSET_AUDIENCES }, { assetId })
        .pipe(timeout({ first: 5000 }))
    );
    const privateAudiences: Array<{
      communityId: string;
      ownerProfileId: string;
    }> = [];
    for (const reference of references || []) {
      // Legacy simple-array links are user-authored. Only latch a previously
      // public asset when the classified owner also owns the asset; otherwise
      // a forged/foreign URL could make someone else's public media private.
      if (
        !assetOwnerProfileId ||
        reference.ownerProfileId !== assetOwnerProfileId
      ) {
        continue;
      }
      const community = await this.findCommunity(reference.communityId);
      if (!community || community.appScope !== reference.appScope) {
        throw new BadGatewayException(
          'Classified asset audience cannot be verified'
        );
      }
      // A reference in any private community latches the asset. Public content
      // elsewhere cannot broaden a URL that has a private audience.
      if (community.isPrivate) {
        privateAudiences.push({
          communityId: reference.communityId,
          ownerProfileId: reference.ownerProfileId,
        });
      }
    }
    return privateAudiences;
  }

  private signViewerAssertion(
    assetId: string,
    profileId: string,
    timestamp: string,
    token: string
  ): string {
    return createHmac('sha256', token)
      .update(`${assetId}:${profileId}:${timestamp}`)
      .digest('hex');
  }
}
