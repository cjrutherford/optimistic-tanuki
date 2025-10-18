import { Module } from '@nestjs/common';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { StorageModule } from '@optimistic-tanuki/storage';
import loadDatabase from './loadDatabase';
import { loadConfig } from './config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    LoggerModule,
    DatabaseModule.register({name: 'assets', factory: loadDatabase}),
    StorageModule.register({
      enabledAdapters: ['local'],
      localStoragePath: './storage',
    })
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {}
