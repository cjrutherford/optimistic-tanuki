import { AssetHandle, CreateAssetDto } from '@optimistic-tanuki/models';
import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: AssetCommands.CREATE })
  async createAsset(data: CreateAssetDto) {
    return await this.appService.createAsset(data);
  }

  @MessagePattern({ cmd: AssetCommands.REMOVE })
  async removeAsset(data: AssetHandle) {
    return await this.appService.removeAsset(data);
  }

  @MessagePattern({ cmd: AssetCommands.RETRIEVE })
  async retrieveAsset(data: AssetHandle) {
    return await this.appService.retrieveAsset(data);
  }

  @MessagePattern({ cmd: AssetCommands.READ})
  async readAsset(data: AssetHandle) {
    const asset = await this.appService.readAsset(data);
    console.log("🚀 ~ AppController ~ readAsset ~ asset:", asset.length)
    return asset;
  }
}
