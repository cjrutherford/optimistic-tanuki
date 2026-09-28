import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { HardwareController } from './hardware.controller';
import { HardwareCatalogService } from './hardware.service';
import { ChassisEntity } from '../hardware/entities/chassis.entity';
import { CaseOptionEntity } from '../hardware/entities/case-option.entity';
import { HardwarePartEntity } from '../hardware/entities/hardware-part.entity';
import { HardwareOrderEntity } from '../hardware/entities/hardware-order.entity';
import { SavedConfigurationEntity } from '../hardware/entities/saved-configuration.entity';
import { CatalogBootstrapService } from '../hardware/catalog-bootstrap.service';
import { PcPartPickerSyncService } from '../hardware/pcpartpicker-sync.service';
import { SupplierOfferEntity } from '../hardware/entities/supplier-offer.entity';
import { CommercialQuoteEntity } from '../hardware/entities/commercial-quote.entity';
import {
  COMMERCIAL_QUOTE_CLOCK,
  CommercialQuoteService,
} from './commercial-quote.service';
import { SupplierOfferImportService } from './supplier-offer-import.service';
import {
  ClientDeploymentArtifactService,
  CLIENT_DEPLOYMENT_ARTIFACT_CLOCK,
} from './client-deployment-artifact.service';
import { AmazonBusinessAdapter } from '../hardware/vendor-api/amazon-business.adapter';
import { AmazonBusinessLiveSyncService } from './amazon-business-live-sync.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'system-configurator',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [HardwareController],
  providers: [
    HardwareCatalogService,
    CatalogBootstrapService,
    PcPartPickerSyncService,
    CommercialQuoteService,
    SupplierOfferImportService,
    ClientDeploymentArtifactService,
    { provide: CLIENT_DEPLOYMENT_ARTIFACT_CLOCK, useValue: () => new Date() },
    AmazonBusinessLiveSyncService,
    {
      provide: AmazonBusinessAdapter,
      useFactory: () =>
        new AmazonBusinessAdapter({
          credentials: {
            clientId: process.env.AMAZON_BUSINESS_CLIENT_ID,
            clientSecret: process.env.AMAZON_BUSINESS_CLIENT_SECRET,
            refreshToken: process.env.AMAZON_BUSINESS_REFRESH_TOKEN,
            userEmail: process.env.AMAZON_BUSINESS_USER_EMAIL,
          },
        }),
    },
    { provide: COMMERCIAL_QUOTE_CLOCK, useValue: () => new Date() },
    {
      provide: getRepositoryToken(ChassisEntity),
      useFactory: (ds: DataSource) => ds.getRepository(ChassisEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(CaseOptionEntity),
      useFactory: (ds: DataSource) => ds.getRepository(CaseOptionEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(HardwarePartEntity),
      useFactory: (ds: DataSource) => ds.getRepository(HardwarePartEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(HardwareOrderEntity),
      useFactory: (ds: DataSource) => ds.getRepository(HardwareOrderEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(SavedConfigurationEntity),
      useFactory: (ds: DataSource) =>
        ds.getRepository(SavedConfigurationEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(SupplierOfferEntity),
      useFactory: (ds: DataSource) => ds.getRepository(SupplierOfferEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(CommercialQuoteEntity),
      useFactory: (ds: DataSource) => ds.getRepository(CommercialQuoteEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
  ],
})
export class AppModule {}
