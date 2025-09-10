import { Body, Controller, Delete, Get, Inject, Param, Post, Res } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateAssetDto } from '@optimistic-tanuki/models';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';

@Controller('asset')
export class AssetController {
    constructor(@Inject(ServiceTokens.ASSETS_SERVICE) private readonly assetService: ClientProxy) {}

    @Post('/')
    async createAsset(@Body() asset: CreateAssetDto) {
        try {
            return await firstValueFrom(this.assetService.send({ cmd: AssetCommands.CREATE }, asset));
        } catch (error) {
            throw new Error(`Failed to create asset: ${error.message || error}`);
        }
    }

    @Delete('/:id')
    async deleteAsset(@Param('id') id: string) {
        try {
            return await firstValueFrom(this.assetService.send({ cmd: AssetCommands.REMOVE }, { id }));
        } catch (error) {
            throw new Error(`Failed to delete asset: ${error.message || error}`);
        }
    }

    @Get('/:id')
    async getAssetById(@Param('id') id: string, @Res() res: Response) {
        try {
            const value = await firstValueFrom(this.assetService.send({ cmd: AssetCommands.READ }, { id }));
            console.log("🚀 ~ AssetController ~ getAssetById ~ value:", value.length);
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
            res.status(500).send(`Failed to get asset: ${error.message || error}`);
        }
    }
}
