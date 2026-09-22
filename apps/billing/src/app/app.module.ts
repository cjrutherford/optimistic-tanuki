import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { InvoicePreviewService } from '@optimistic-tanuki/billing-domain';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { AppController } from './app.controller';
import { BillingService } from './services/billing.service';
import {
  INVOICE_REPOSITORY,
  USAGE_BLOCK_REPOSITORY,
  USAGE_EVENT_REPOSITORY,
} from './services/billing.repositories';
import {
  TypeOrmInvoiceRepository,
  TypeOrmUsageBlockRepository,
  TypeOrmUsageEventRepository,
} from './services/typeorm-billing.repositories';
import { UsageBlocksService } from './services/usage-blocks.service';
import { UsageMeteringService } from './services/usage-metering.service';
import { BillingSubscriptionsService } from './services/billing-subscriptions.service';

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
    BillingSubscriptionsService,
    TypeOrmUsageEventRepository,
    TypeOrmUsageBlockRepository,
    TypeOrmInvoiceRepository,
    {
      provide: USAGE_EVENT_REPOSITORY,
      useExisting: TypeOrmUsageEventRepository,
    },
    {
      provide: USAGE_BLOCK_REPOSITORY,
      useExisting: TypeOrmUsageBlockRepository,
    },
    {
      provide: INVOICE_REPOSITORY,
      useExisting: TypeOrmInvoiceRepository,
    },
  ],
})
export class AppModule {}
