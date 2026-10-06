import { Module } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadConfig from './loadConfig';
import loadDatabase from './loadDatabase';
import { Conversation, Message } from './entities';
import { DataSource } from 'typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { LoggerModule } from '@optimistic-tanuki/logger';

@Module({
  imports: [
    LoggerModule,
    ClientsModule.register([
      {
        name: ServiceTokens.SOCIAL_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.SOCIAL_HOST || 'social',
          port: Number(process.env.SOCIAL_PORT || 3003),
        },
      },
      {
        name: ServiceTokens.PROJECT_PLANNING_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.PROJECT_PLANNING_HOST || 'project-planning',
          port: Number(process.env.PROJECT_PLANNING_PORT || 3006),
        },
      },
    ]),
    ConfigModule.forRoot({
      load: [loadConfig],
      isGlobal: true,
    }),
    DatabaseModule.register({
      name: 'chat_collector',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: getRepositoryToken(Message),
      useFactory: (ds: DataSource) => ds.getRepository(Message),
      inject: ['CHAT_COLLECTOR_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Conversation),
      useFactory: (ds: DataSource) => ds.getRepository(Conversation),
      inject: ['CHAT_COLLECTOR_CONNECTION'],
    },
  ],
})
export class AppModule {}
