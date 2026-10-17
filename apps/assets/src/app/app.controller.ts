import {
  AssetHandle,
  AssetListQuery,
  CreateAssetDto,
} from '@optimistic-tanuki/models';
import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';
import { AssetCommands } from '@optimistic-tanuki/constants';
import { GuardianAssetActor } from './guardian-asset-authorization.service';
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

  @MessagePattern({ cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS })
  async addAudienceRestrictions(data: {
    id: string;
    restrictions: import('@optimistic-tanuki/models').AssetAudienceRestriction[];
  }) {
    try {
      return await this.appService.addAudienceRestrictions(data);
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

  @MessagePattern({ cmd: AssetCommands.GUARDIAN_CREATE })
  async createGuardianAsset(
    data: GuardianAssetActor & { asset: CreateAssetDto }
  ) {
    try {
      return await this.appService.createGuardianAsset(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.GUARDIAN_LIST })
  async listGuardianAssets(
    data: GuardianAssetActor & {
      type?: import('@optimistic-tanuki/models').AssetType;
    }
  ) {
    try {
      return await this.appService.listGuardianAssets(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.GUARDIAN_REMOVE })
  async removeGuardianAsset(data: GuardianAssetActor & { id: string }) {
    try {
      return await this.appService.deleteGuardianAsset(data);
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: AssetCommands.GUARDIAN_AUTHORIZE_READ })
  async authorizeGuardianRead(data: GuardianAssetActor & { id: string }) {
    try {
      await this.appService.authorizeGuardianRead(data);
      return { success: true };
    } catch (error) {
      throw new RpcException(error);
    }
  }
}
