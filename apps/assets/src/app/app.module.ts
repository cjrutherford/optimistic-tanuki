import { Module } from '@nestjs/common';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '@optimistic-tanuki/database';
import {
  StorageModule,
  FileValidationService,
  VirusScanService,
} from '@optimistic-tanuki/storage';
import loadDatabase from './loadDatabase';
import { loadConfig } from './config';
import AssetEntity from '../entities/asset.entity';
import { DataSource } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    LoggerModule,
    DatabaseModule.register({ name: 'assets', factory: loadDatabase }),
    StorageModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const storageStrategy =
          configService.get<string>('storageStrategy') || 'local';
        const localStoragePath =
          configService.get<string>('storagePath') || './storage';

        if (storageStrategy === 'network') {
          const s3Config = configService.get<any>('s3');
          return {
            enabledAdapters: ['network'],
            s3Options: {
              endpoint: s3Config?.endpoint || 'http://localhost:9000',
              region: 'us-east-1',
              accessKeyId: s3Config?.accessKey || 'seaweedfs',
              secretAccessKey: s3Config?.secretKey || 'seaweedfs',
              bucketName: s3Config?.bucket || 'assets',
            },
          };
        }

        return {
          enabledAdapters: ['local'],
          localStoragePath,
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    FileValidationService,
    VirusScanService,
    {
      provide: getRepositoryToken(AssetEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AssetEntity),
      inject: ['ASSETS_CONNECTION'],
    },
  ],
})
export class AppModule {}
