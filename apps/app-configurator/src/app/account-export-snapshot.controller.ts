import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { AppConfiguratorAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class AppConfiguratorAccountExportSnapshotController {
  constructor(
    private readonly captures: AppConfiguratorAccountExportSnapshotService
  ) {}
  @MessagePattern({ cmd: AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE }) open(
    @Payload() input: unknown
  ) {
    return this.captures.open(input);
  }
  @MessagePattern({ cmd: AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE }) read(
    @Payload() input: unknown
  ) {
    return this.captures.read(input);
  }
  @MessagePattern({ cmd: AppConfigCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
