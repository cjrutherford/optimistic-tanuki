import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { EditionsQueryService } from './editions-query.service';

/** Published briefings for the gateway's public routes. */
@Controller()
export class EditionsController {
  constructor(private readonly editions: EditionsQueryService) {}

  @MessagePattern({ cmd: CivicBriefingCommands.EDITIONS })
  list() {
    return this.editions.editions();
  }

  @MessagePattern({ cmd: CivicBriefingCommands.EDITION_HISTORY })
  history(@Payload() payload: { slug: string }) {
    return this.editions.history(payload.slug);
  }

  @MessagePattern({ cmd: CivicBriefingCommands.BRIEFING })
  briefing(@Payload() payload: { slug: string; periodEnd?: string }) {
    return this.editions.briefing(payload.slug, payload.periodEnd);
  }
}
