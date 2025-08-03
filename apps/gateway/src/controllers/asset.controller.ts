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
        console.log("🚀 ~ AssetController ~ createAsset ~ asset:", asset)
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.CREATE }, asset));
    }

    @Delete('/:id')
    async deleteAsset(@Param('id') id: string) {
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.REMOVE }, { id }));
    }

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
