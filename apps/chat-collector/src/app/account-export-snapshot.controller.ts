import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatCommands } from '@optimistic-tanuki/constants';
import { ChatAccountExportSnapshotService } from './account-export-snapshot.service';

@Controller()
export class ChatAccountExportSnapshotController {
  constructor(private readonly captures: ChatAccountExportSnapshotService) {}

  @MessagePattern({ cmd: ChatCommands.OPEN_ACCOUNT_EXPORT_CAPTURE })
  open(@Payload() input: unknown) {
    return this.captures.open(input);
  }

  @MessagePattern({ cmd: ChatCommands.READ_ACCOUNT_EXPORT_CAPTURE })
  read(@Payload() input: unknown) {
    return this.captures.read(input);
  }

  @MessagePattern({ cmd: ChatCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE })
  release(@Payload() input: unknown) {
    return this.captures.release(input);
  }
}
