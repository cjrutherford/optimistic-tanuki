import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { InvoicePreviewService } from '@optimistic-tanuki/billing-domain';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { AppController } from './app.controller';
import { BillingService } from './services/billing.service';
import {
  USAGE_BLOCK_REPOSITORY,
  USAGE_EVENT_REPOSITORY,
} from './services/billing.repositories';
import {
  TypeOrmUsageBlockRepository,
  TypeOrmUsageEventRepository,
} from './services/typeorm-billing.repositories';
import { UsageBlocksService } from './services/usage-blocks.service';
import { UsageMeteringService } from './services/usage-metering.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'billing',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    BillingService,
    InvoicePreviewService,
    UsageMeteringService,
    UsageBlocksService,
    TypeOrmUsageEventRepository,
    TypeOrmUsageBlockRepository,
    {
      provide: USAGE_EVENT_REPOSITORY,
      useExisting: TypeOrmUsageEventRepository,
    },
    {
      provide: USAGE_BLOCK_REPOSITORY,
      useExisting: TypeOrmUsageBlockRepository,
    },
  ],
})
export class AppModule {}
