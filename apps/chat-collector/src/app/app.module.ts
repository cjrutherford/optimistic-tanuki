import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadConfig from './loadConfig';
import loadDatabase from './loadDatabase';
import { LoggerModule } from '@optimistic-tanuki/logger';

@Module({
  imports: [
    LoggerModule,
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
  ],
})
export class AppModule {}
