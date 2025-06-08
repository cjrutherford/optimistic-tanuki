import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';

@Controller('asset')
export class AssetController {
    constructor(@Inject(ServiceTokens.ASSETS_SERVICE) private readonly assetService: ClientProxy) {}

    @Get('/:id')
    async getAssetById(@Param('id') id: string) {
        return firstValueFrom(this.assetService.send({ cmd: AssetCommands.READ }, { id }));
    }
}
