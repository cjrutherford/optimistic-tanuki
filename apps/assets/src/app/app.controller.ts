import { AssetHandle, CreateAssetDto } from '@optimistic-tanuki/models';
import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { MessagePattern, RpcException } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: AssetCommands.CREATE })
  async createAsset(data: CreateAssetDto) {
    try {
      const value = await this.appService.createAsset(data);
      console.log("🚀 ~ AppController ~ createAsset ~ value:", value);
      return value;
    } catch (error) {
      console.trace(error);
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.REMOVE })
  async removeAsset(data: AssetHandle) {
    try {
      return await this.appService.removeAsset(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.RETRIEVE })
  async retrieveAsset(data: AssetHandle) {
    try {
      return await this.appService.retrieveAsset(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.READ })
  async readAsset(data: AssetHandle) {
    try {
      const asset = await this.appService.readAsset(data);
      console.log("🚀 ~ AppController ~ readAsset ~ asset:", asset.length);
      return asset;
    } catch (error) {
      throw new RpcException(error);
    }
  }
}
