import { Module } from '@nestjs/common';
import { LocalitiesController } from './localities.controller';

/** Serves LIST_LOCALITIES. Needs LocalityRegistrySource from the module that provides it (global or imported). */
@Module({ controllers: [LocalitiesController] })
export class LocalitiesModule {}
