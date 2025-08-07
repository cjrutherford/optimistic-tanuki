import { Body, Controller, Delete, Get, Inject, Param, Post, Res } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateAssetDto } from '@optimistic-tanuki/models';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';

/**
 * Controller for handling asset-related API requests.
 */
@Controller('asset')
export class AssetController {
    /**
     * Creates an instance of AssetController.
     * @param assetService Client proxy for the assets microservice.
     */
    constructor(@Inject(ServiceTokens.ASSETS_SERVICE) private readonly assetService: ClientProxy) {}

    /**
     * Creates a new asset.
     * @param asset The asset data to create.
     * @returns A Promise that resolves to the created asset.
     */
    @Post('/')
    async createAsset(@Body() asset: CreateAssetDto) {
        console.log("🚀 ~ AssetController ~ createAsset ~ asset:", asset)
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.CREATE }, asset));
    }

    /**
     * Deletes an asset by its ID.
     * @param id The ID of the asset to delete.
     * @returns A Promise that resolves when the asset is deleted.
     */
    @Delete('/:id')
    async deleteAsset(@Param('id') id: string) {
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.REMOVE }, { id }));
    }

    /**
     * Retrieves an asset by its ID and sends it as a response.
     * @param id The ID of the asset to retrieve.
     * @param res The Express response object.
     */
    @Get('/:id')
    async getAssetById(@Param('id') id: string, @Res() res: Response) {
        const value = await firstValueFrom(this.assetService.send({ cmd: AssetCommands.READ }, { id }));
        console.log("🚀 ~ AssetController ~ getAssetById ~ value:", value.length);
        const matches = value.match(/^data:(.*?);base64,(.*)$/);
        if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            res.setHeader('Content-Type', mimeType);
            res.send(buffer);
        }
        else {
            res.status(400).send('Invalid asset format');
        }
    }
}
