import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CIVIC_GET_OFFICIALS } from '@optimistic-tanuki/constants';
import { CivicOfficialsService } from './civic-officials.service';

@Controller()
export class CivicOfficialsController {
  constructor(private readonly officials: CivicOfficialsService) {}

  @MessagePattern(CIVIC_GET_OFFICIALS)
  getOfficials(@Payload() payload?: { town?: string }) {
    return this.officials.list(payload?.town?.trim() || undefined);
  }
}
