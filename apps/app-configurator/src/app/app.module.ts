import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { getRepositoryToken } from '@nestjs/typeorm';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import { ConfigurationsService } from './configurations.service';
import { ConfigurationsController } from '../configurations/configurations.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'app-configurator',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [ConfigurationsController],
  providers: [
    ConfigurationsService,
    Logger,
    {
      provide: getRepositoryToken(AppConfigurationEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AppConfigurationEntity),
      inject: ['APP-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AppInstanceEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AppInstanceEntity),
      inject: ['APP-CONFIGURATOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AppMembershipEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AppMembershipEntity),
      inject: ['APP-CONFIGURATOR_CONNECTION'],
    },
  ],
})
export class AppModule {}
