import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { AsymmetricService, SaltedHashService } from '@optimistic-tanuki/encryption';
import { LoggerModule } from '@optimistic-tanuki/logger';
import * as jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import loadConfig from '../config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KeyService } from './key.service';
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'authentication',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SaltedHashService,
    KeyService,
    AsymmetricService,
    {
      provide: 'totp',
      useValue: authenticator,
    },
    {
      provide: 'JWT_SECRET',
      useFactory: (config: ConfigService) => config.get('auth')?.jwt_secret || 'default_jwt_secret',
      inject: [ConfigService],
    },
    {
      provide: 'jwt',
      useValue: jwt,
    }
  ],
})
export class AppModule {}
