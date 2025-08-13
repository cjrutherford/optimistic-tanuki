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

@Module({
  imports: [
    ConfigModule.forRoot({ 
      load: [loadConfig],
      isGlobal: true,
    }),
    DatabaseModule.register({
      name: 'chat_collector',
      factory: loadDatabase,
    })
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: getRepositoryToken(Message),
      useFactory: (ds: DataSource) => ds.getRepository(Message),
      inject: ['CHAT_COLLECTOR_CONNECTION'],
    },{
      provide: getRepositoryToken(Conversation),
      useFactory: (ds: DataSource) => ds.getRepository(Conversation),
      inject: ['CHAT_COLLECTOR_CONNECTION'],
    }
  ],
})
export class AppModule {}
