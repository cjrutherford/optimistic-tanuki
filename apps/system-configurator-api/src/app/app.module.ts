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
      useFactory: (ds: DataSource) => ds.getRepository(SavedConfigurationEntity),
      inject: ['SYSTEM-CONFIGURATOR_CONNECTION'],
    },
  ],
})
export class AppModule {}
