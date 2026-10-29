import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ForumCommands } from '@optimistic-tanuki/constants';
import { ForumAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class ForumAccountExportSnapshotController {
  constructor(private readonly captures: ForumAccountExportSnapshotService) {}

  @MessagePattern({ cmd: ForumCommands.OPEN_ACCOUNT_EXPORT_CAPTURE })
  open(@Payload() input: unknown) {
    return this.captures.open(input);
  }

  @MessagePattern({ cmd: ForumCommands.READ_ACCOUNT_EXPORT_CAPTURE })
  read(@Payload() input: unknown) {
    return this.captures.read(input);
  }

  @MessagePattern({ cmd: ForumCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
