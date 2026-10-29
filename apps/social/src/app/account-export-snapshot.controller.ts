import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SocialCommands } from '@optimistic-tanuki/constants';
import { SocialAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class SocialAccountExportSnapshotController {
  constructor(private readonly captures: SocialAccountExportSnapshotService) {}

  @MessagePattern({ cmd: SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE })
  open(@Payload() input: unknown) {
    return this.captures.open(input);
  }

  @MessagePattern({ cmd: SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE })
  read(@Payload() input: unknown) {
    return this.captures.read(input);
  }

  @MessagePattern({ cmd: SocialCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
