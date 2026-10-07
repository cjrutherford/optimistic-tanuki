import {
  AssetHandle,
  AssetListQuery,
  CreateAssetDto,
} from '@optimistic-tanuki/models';
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
      return await this.appService.createAsset(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.ADD_COMMUNITY_AUDIENCE })
  async addCommunityAudience(data: { id: string; communityId: string }) {
    try {
      return await this.appService.addCommunityAudience(data);
    } catch (error) {
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

  @MessagePattern({ cmd: AssetCommands.LIST })
  async listAssets(data: AssetListQuery) {
    try {
      return await this.appService.listAssets(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.READ })
  async readAsset(data: AssetHandle) {
    try {
      return await this.appService.readAsset(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }
}
