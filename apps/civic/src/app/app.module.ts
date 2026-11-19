import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { CivicController } from './civic/civic.controller';
import { CivicService } from './civic/civic.service';
import { CivicTenantsController } from './civic/civic-tenants.controller';
import { CivicOfficialsController } from './civic/civic-officials.controller';
import { CivicOfficialsService } from './civic/civic-officials.service';
import { CivicTenantsService } from './civic/civic-tenants.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'civic',
      factory: loadDatabase,
    }),
  ],
  controllers: [
    CivicController,
    CivicTenantsController,
    CivicOfficialsController,
  ],
  providers: [
    CivicTenantsService,
    {
      provide: CivicOfficialsService,
      useFactory: (dataSource) => new CivicOfficialsService(dataSource),
      inject: ['CIVIC_CONNECTION'],
    },
    {
      provide: CivicService,
      useFactory: (dataSource, config: ConfigService) =>
        new CivicService(dataSource, {
          agendaSources: config.get('agendaSources') ?? [],
          agendaPollIntervalMs: config.get('agendaPollIntervalMs'),
        }),
      inject: ['CIVIC_CONNECTION', ConfigService],
    },
  ],
})
export class AppModule {}
