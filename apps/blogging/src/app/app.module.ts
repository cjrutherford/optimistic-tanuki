import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { EventController, PostController, ContactController } from './controllers';
import { EventService, PostService, ContactService } from './services';
import config from './config'
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config]
    }),
    DatabaseModule.register({
      name: 'blogging',
      factory: loadDatabase,
    })
  ],
  controllers: [EventController, PostController, ContactController],
  providers: [
    EventService, 
    PostService, 
    ContactService,
  ],
})
export class AppModule {}
