import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
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
    ClientsModule.register([
      {
        name: ServiceTokens.PERMISSIONS_SERVICE,
        transport: Transport.REDIS,
        options: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
    ]),
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
  ],
})
export class AppModule {}
