import { Body, Controller, Delete, Get, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateAssetDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

@Controller('asset')
export class AssetController {
    constructor(@Inject(ServiceTokens.ASSETS_SERVICE) private readonly assetService: ClientProxy) {}

    @Post('/')
    async createAsset(@Body() asset: CreateAssetDto) {
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.CREATE }, asset));
    }

    @Delete('/:id')
    async deleteAsset(@Param('id') id: string) {
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.REMOVE }, { id }));
    }

    @Get('/:id')
    async getAssetById(@Param('id') id: string) {
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.READ }, { id }));
    }
}
