import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { VideoCommands } from '@optimistic-tanuki/constants';
import { VideosAccountExportSnapshotService } from './account-export-snapshot.service';
@Controller()
export class AccountExportController {
  constructor(private readonly captures: VideosAccountExportSnapshotService) {}
  @MessagePattern({ cmd: VideoCommands.OPEN_ACCOUNT_EXPORT_CAPTURE }) open(
    @Payload() input: unknown
  ) {
    return this.captures.open(input);
  }
  @MessagePattern({ cmd: VideoCommands.READ_ACCOUNT_EXPORT_CAPTURE }) read(
    @Payload() input: unknown
  ) {
    return this.captures.read(input);
  }
  @MessagePattern({ cmd: VideoCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
