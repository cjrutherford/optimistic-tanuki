import { Global, Module, OnModuleInit } from '@nestjs/common';
import { registerAllAdapters } from '@optimistic-tanuki/civic-adapters';

/**
 * Makes every protocol adapter available to the stages.
 *
 * The list is shared with the command line rather than repeated here: a
 * locality names its adapter by string, so a missing registration is not a
 * type error but a town silently losing a source.
 */
@Global()
@Module({})
export class AdaptersModule implements OnModuleInit {
  onModuleInit(): void {
    registerAllAdapters();
  }
}
