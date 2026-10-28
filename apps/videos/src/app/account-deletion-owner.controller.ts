import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { VideoCommands } from '@optimistic-tanuki/constants';
import { VideosAccountDeletionOwnerService } from './account-deletion-owner.service';
@Controller()
export class VideosAccountDeletionOwnerController {
  constructor(private readonly owner: VideosAccountDeletionOwnerService) {}
  @MessagePattern({ cmd: VideoCommands.FENCE_ACCOUNT_DELETION }) fence(
    @Payload() payload: unknown
  ) {
    return this.owner.execute(payload, 'fence');
  }
  @MessagePattern({ cmd: VideoCommands.ERASE_ACCOUNT_DELETION }) erase(
    @Payload() payload: unknown
  ) {
    return this.owner.execute(payload, 'erase');
  }
  @MessagePattern({ cmd: VideoCommands.READBACK_ACCOUNT_DELETION }) readback(
    @Payload() payload: unknown
  ) {
    return this.owner.execute(payload, 'readback');
  }
}
