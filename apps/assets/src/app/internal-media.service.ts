import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import {
  GuardianContentCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  InternalGuardianMediaAssertion,
  StorageStrategy,
} from '@optimistic-tanuki/models';
import { basename, extname } from 'node:path';
import { Readable } from 'node:stream';
import { firstValueFrom, timeout } from 'rxjs';

import { AppService } from './app.service';
import { GuardianAssetActor } from './guardian-asset-authorization.service';

export type MediaStreamResult = {
  statusCode: 200 | 206;
  contentType: string;
  contentLength: number;
  contentRange?: string;
  stream: Readable;
  cleanup: () => Promise<void>;
};

export type UnsatisfiedMediaRange = {
  statusCode: 416;
  contentRange: string;
};

@Injectable()
export class InternalMediaService {
  private readonly maxPlaintextBytes: number;

  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialService?: ClientProxy
  ) {
    const configured = this.configService.get<number>('mediaMaxReadBytes');
    this.maxPlaintextBytes =
      Number.isSafeInteger(configured) && (configured as number) > 0
        ? (configured as number)
        : 1024 * 1024 * 1024;
  }

  async open(
    id: string,
    range?: string,
    viewerAuthorized = false,
    signal?: AbortSignal,
    guardianActor?: GuardianAssetActor,
    mediaAssertion?: InternalGuardianMediaAssertion,
    signedViewerProfileId?: string
  ): Promise<MediaStreamResult | UnsatisfiedMediaRange> {
    let asset: Awaited<ReturnType<AppService['retrieveAsset']>>;
    try {
      asset = await this.appService.retrieveAsset({ id });
    } catch (error) {
      const detail = error instanceof RpcException ? error.getError() : error;
      const statusCode =
        detail && typeof detail === 'object' && 'statusCode' in detail
          ? detail.statusCode
          : undefined;
      if (error instanceof NotFoundException || statusCode === 404) {
        throw new NotFoundException(`Asset with id ${id} not found`);
      }
      throw error;
    }
    const restrictions = Array.isArray(asset.audienceRestrictions)
      ? asset.audienceRestrictions
      : [];
    const staged = asset.originKind === 'guardian-staged';
    const stageMarkers = restrictions.filter(
      (restriction) => restriction?.type === 'guardian-staged'
    );
    let legacyGuardianLibraryAuthorized = false;
    if (!staged && guardianActor) {
      const pureOwnerLibrary =
        asset.profileId === guardianActor.targetProfileId &&
        !asset.audienceCommunityIds?.length &&
        restrictions.length > 0 &&
        restrictions.every(
          (restriction) =>
            restriction?.type === 'owner' &&
            restriction.profileId === guardianActor.targetProfileId
        );
      if (pureOwnerLibrary) {
        try {
          await this.appService.authorizeGuardianRead({ ...guardianActor, id });
          legacyGuardianLibraryAuthorized = true;
        } catch (error) {
          const detail =
            error instanceof RpcException ? error.getError() : error;
          if (
            detail &&
            typeof detail === 'object' &&
            'code' in detail &&
            detail.code === 'GUARDIAN_CONTENT_ACCESS_DENIED'
          )
            throw new NotFoundException(`Asset with id ${id} not found`);
          throw error;
        }
      }
    }
    if (staged || stageMarkers.length) {
      if (
        !staged ||
        asset.originProfileId !== asset.profileId ||
        !['client-interface', 'local-hub'].includes(asset.originAppId ?? '') ||
        stageMarkers.length !== 1 ||
        stageMarkers[0].profileId !== asset.originProfileId ||
        stageMarkers[0].appId !== asset.originAppId ||
        !mediaAssertion ||
        mediaAssertion.version !== 1 ||
        mediaAssertion.assetId !== id ||
        mediaAssertion.dependentProfileId !== asset.originProfileId ||
        mediaAssertion.appId !== asset.originAppId ||
        mediaAssertion.path !== `/api/asset/${id}` ||
        mediaAssertion.range !== (range ?? null) ||
        mediaAssertion.viewerProfileId !==
          (signedViewerProfileId === 'public'
            ? null
            : signedViewerProfileId ?? null)
      )
        throw new NotFoundException(`Asset with id ${id} not found`);
      try {
        if (mediaAssertion.accessMode === 'published') {
          if (
            !this.socialService ||
            !mediaAssertion.resourceType ||
            !mediaAssertion.resourceId
          )
            throw new Error('grant unavailable');
          const allowed = await firstValueFrom(
            this.socialService
              .send<boolean>(
                { cmd: GuardianContentCommands.CheckPublishedAssetGrant },
                {
                  assetId: id,
                  appId: mediaAssertion.appId,
                  dependentProfileId: mediaAssertion.dependentProfileId,
                  resourceType: mediaAssertion.resourceType,
                  resourceId: mediaAssertion.resourceId,
                  viewerProfileId: mediaAssertion.viewerProfileId ?? undefined,
                  viewerUserId: mediaAssertion.viewerUserId ?? undefined,
                }
              )
              .pipe(timeout({ first: 3000 }))
          );
          if (allowed !== true)
            throw new NotFoundException(`Asset with id ${id} not found`);
        } else if (mediaAssertion.accessMode === 'guardian-library') {
          if (
            !mediaAssertion.viewerUserId ||
            !guardianActor ||
            guardianActor.actorUserId !== mediaAssertion.viewerUserId ||
            guardianActor.targetProfileId !==
              mediaAssertion.dependentProfileId ||
            guardianActor.appId !== mediaAssertion.appId
          )
            throw new NotFoundException(`Asset with id ${id} not found`);
          await this.appService.authorizeGuardianRead({ ...guardianActor, id });
        } else if (mediaAssertion.accessMode === 'dependent-owner') {
          if (
            !mediaAssertion.viewerProfileId ||
            mediaAssertion.viewerProfileId !== asset.profileId ||
            mediaAssertion.resourceId !== null ||
            mediaAssertion.resourceType !== null
          )
            throw new NotFoundException(`Asset with id ${id} not found`);
        } else throw new NotFoundException(`Asset with id ${id} not found`);
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        const detail = error instanceof RpcException ? error.getError() : error;
        if (
          detail &&
          typeof detail === 'object' &&
          'code' in detail &&
          detail.code === 'GUARDIAN_CONTENT_ACCESS_DENIED'
        )
          throw new NotFoundException(`Asset with id ${id} not found`);
        throw new NotFoundException(`Asset with id ${id} not found`);
      }
    } else if (
      asset.originKind !== 'ordinary' ||
      asset.originProfileId ||
      asset.originAppId
    ) {
      throw new NotFoundException(`Asset with id ${id} not found`);
    }
    const ordinaryRestrictions = restrictions.filter(
      (restriction) => restriction?.type !== 'guardian-staged'
    );
    if (
      (asset.audienceCommunityIds?.length || ordinaryRestrictions.length) &&
      !viewerAuthorized &&
      !legacyGuardianLibraryAuthorized
    ) {
      throw new NotFoundException(`Asset with id ${id} not found`);
    }
    if (
      asset.storageStrategy !== StorageStrategy.LOCAL_BLOCK_STORAGE &&
      asset.storageStrategy !== StorageStrategy.REMOTE_BLOCK_STORAGE
    ) {
      throw new NotFoundException(`Asset with id ${id} cannot be streamed`);
    }

    const content = await this.appService.openAuthenticatedMedia(asset, {
      maxPlaintextBytes: this.maxPlaintextBytes,
      signal,
    });
    const byteRange = this.parseRange(range, content.size);
    if (byteRange === null) {
      await content.cleanup();
      return { statusCode: 416, contentRange: `bytes */${content.size}` };
    }

    const start = byteRange?.start ?? 0;
    const end = byteRange?.end ?? content.size - 1;
    return {
      statusCode: byteRange ? 206 : 200,
      contentType: this.getContentType(asset.name),
      contentLength: content.size === 0 ? 0 : end - start + 1,
      ...(byteRange
        ? { contentRange: `bytes ${start}-${end}/${content.size}` }
        : {}),
      stream: content.createReadStream(
        content.size === 0 ? undefined : start,
        content.size === 0 ? undefined : end
      ),
      cleanup: content.cleanup,
    };
  }

  private parseRange(
    range: string | undefined,
    size: number
  ): { start: number; end: number } | undefined | null {
    if (!range) return undefined;

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === '' && match[2] === '')) return null;

    const [, rawStart, rawEnd] = match;
    if (rawStart === '') {
      const suffixLength = Number(rawEnd);
      if (
        !Number.isSafeInteger(suffixLength) ||
        suffixLength <= 0 ||
        size === 0
      ) {
        return null;
      }
      const start = Math.max(size - suffixLength, 0);
      return { start, end: size - 1 };
    }

    const start = Number(rawStart);
    const requestedEnd = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(requestedEnd) ||
      start < 0 ||
      requestedEnd < start ||
      start >= size
    ) {
      return null;
    }

    return { start, end: Math.min(requestedEnd, size - 1) };
  }

  private getContentType(name: string): string {
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.m4v': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/mp2t',
    };
    return (
      contentTypes[extname(basename(name)).toLowerCase()] ||
      'application/octet-stream'
    );
  }
}
