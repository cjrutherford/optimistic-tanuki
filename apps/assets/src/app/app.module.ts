import { Module } from '@nestjs/common';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { StorageModule } from '@optimistic-tanuki/storage';
import loadDatabase from './loadDatabase';
import { loadConfig } from './config';
import AssetEntity from '../entities/asset.entity';
import { DataSource } from 'typeorm';
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
    {
      provide: getRepositoryToken(AssetEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AssetEntity),
      inject: ['ASSETS_CONNECTION'],
    }
  ],
})
export class AppModule {}
