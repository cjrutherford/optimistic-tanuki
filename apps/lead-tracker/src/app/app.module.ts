import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { DataSource } from 'typeorm';
import { Lead } from '@optimistic-tanuki/models';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import loadConfig from '../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'lead_tracker',
      factory: (config: ConfigService) => {
        const database = config.get('database');
        return {
          type: 'postgres',
          host: database.host,
          port: database.port,
          username: database.username,
          password: database.password,
          database: database.database,
          entities: [Lead],
        };
      },
    }),
  ],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    {
      provide: getRepositoryToken(Lead),
      useFactory: (ds: DataSource) => ds.getRepository(Lead),
      inject: ['LEAD_TRACKER_CONNECTION'],
    },
  ],
})
export class AppModule {}
