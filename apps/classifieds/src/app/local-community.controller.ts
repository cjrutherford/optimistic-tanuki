import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LocalCommunityCommands } from '@optimistic-tanuki/constants';
import { LocalCommunityService } from './local-community.service';

@Controller()
export class LocalCommunityController {
  private readonly logger = new Logger(LocalCommunityController.name);

  constructor(private readonly localCommunityService: LocalCommunityService) {}

  @MessagePattern({ cmd: LocalCommunityCommands.LIST })
  list() {
    return this.localCommunityService.list();
  }

  @MessagePattern({ cmd: LocalCommunityCommands.FIND_BY_SLUG })
  findBySlug(@Payload() data: { slug: string }) {
    return this.localCommunityService.findBySlug(data.slug);
  }

  @MessagePattern({ cmd: LocalCommunityCommands.JOIN })
  join(
    @Payload() data: { communityId: string; userId: string; profileId: string }
  ) {
    return this.localCommunityService.join(
      data.communityId,
      data.userId,
      data.profileId
    );
  }

  @MessagePattern({ cmd: LocalCommunityCommands.LEAVE })
  leave(@Payload() data: { communityId: string; userId: string }) {
    return this.localCommunityService.leave(data.communityId, data.userId);
  }

  @MessagePattern({ cmd: LocalCommunityCommands.IS_MEMBER })
  isMember(@Payload() data: { communityId: string; userId: string }) {
    return this.localCommunityService.isMember(data.communityId, data.userId);
  }
}
