import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { LocalityConfig } from '@optimistic-tanuki/civic-core';
import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { LocalityRegistrySource } from './locality-registry.source';

/** The loaded locality registry, for civic-contributions (it has no database access to it). */
@Controller()
export class LocalitiesController {
  constructor(private readonly registry: LocalityRegistrySource) {}

  @MessagePattern({ cmd: CivicBriefingCommands.LIST_LOCALITIES })
  list(): LocalityConfig[] {
    return [...this.registry.current().all()];
  }
}
