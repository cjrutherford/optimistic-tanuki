import {
  Body,
  BadGatewayException,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  AssetListQuery,
  AssetType,
  CreateAssetDto,
} from '@optimistic-tanuki/models';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'node:stream';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { AuthGuard } from '../auth/auth.guard';
import { LongRunning } from '../decorators/request-timeout.decorator';

@Controller('asset')
export class AssetController {
  constructor(
    @Inject(ServiceTokens.ASSETS_SERVICE)
    private readonly assetService: ClientProxy,
    private readonly configService: ConfigService
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
  async createAsset(@Body() asset: CreateAssetDto) {
    try {
      return await firstValueFrom(
        this.assetService.send({ cmd: AssetCommands.CREATE }, asset)
      );
    } catch (error) {
      throw this.toHttpException(error, 'Failed to create asset');
    }
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('/:id')
  @RequirePermissions('asset.delete')
  async deleteAsset(@Param('id') id: string) {
    try {
      return await firstValueFrom(
        this.assetService.send({ cmd: AssetCommands.REMOVE }, { id })
      );
    } catch (error) {
      throw this.toHttpException(error, 'Failed to delete asset');
    }
  }

  @Get('/:id')
  @LongRunning()
  async getAssetById(
    @Param('id') id: string,
    @Res() res: Response,
    @Headers('range') range?: string
  ) {
    try {
      const mediaUrl = this.configService.get<string>(
        'ASSETS_INTERNAL_MEDIA_URL'
      );
      const mediaToken = this.configService.get<string>(
        'ASSETS_INTERNAL_MEDIA_TOKEN'
      );

      if (!mediaUrl || !mediaToken) {
        throw new BadGatewayException(
          'Internal media streaming is unavailable'
        );
      }

      const headers: Record<string, string> = {
        'X-Internal-Media-Token': mediaToken,
      };
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
      if (error instanceof BadGatewayException) {
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
    @Query('type') type?: AssetType
  ) {
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
}
