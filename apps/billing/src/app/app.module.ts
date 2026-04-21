import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { InvoicePreviewService } from '@optimistic-tanuki/billing-domain';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { AppController } from './app.controller';
import { BillingService } from './services/billing.service';
import {
  InMemoryUsageBlockRepository,
  InMemoryUsageEventRepository,
} from './services/in-memory-billing.repositories';
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
    InMemoryUsageEventRepository,
    InMemoryUsageBlockRepository,
  ],
})
export class AppModule {}
