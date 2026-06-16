import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  AssetListQuery,
  AssetType,
  CreateAssetDto,
} from '@optimistic-tanuki/models';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { AuthGuard } from '../auth/auth.guard';

@Controller('asset')
export class AssetController {
  constructor(
    @Inject(ServiceTokens.ASSETS_SERVICE)
    private readonly assetService: ClientProxy
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
  async getAssetById(@Param('id') id: string, @Res() res: Response) {
    try {
      const value = await firstValueFrom(
        this.assetService.send({ cmd: AssetCommands.READ }, { id })
      );
      const matches = value.match(/^data:(.*?);base64,(.*)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', mimeType);
        res.send(buffer);
      } else {
        res.status(400).send('Invalid asset format');
      }
    } catch (error) {
      res.status(500).send(`Failed to get asset: ${this.errorMessage(error)}`);
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
