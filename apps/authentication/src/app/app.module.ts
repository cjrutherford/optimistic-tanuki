import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  MfaService,
  PasswordPolicyService,
} from '@optimistic-tanuki/auth-domain';
import { DatabaseModule } from '@optimistic-tanuki/database';
import {
  AsymmetricService,
  SaltedHashService,
} from '@optimistic-tanuki/encryption';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { authenticator } from 'otplib';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { UserEntity } from '../user/entities/user.entity';
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
    {
      provide: JwtService,
      useFactory: (config: ConfigService) => {
        const secret = config.get('auth.jwt_secret') || 'default_jwt_secret';
        return new JwtService({ secret });
      },
      inject: [ConfigService],
    },
    AppService,
    SaltedHashService,
    PasswordPolicyService,
    KeyService,
    AsymmetricService,
    {
      provide: 'totp',
      useValue: authenticator,
    },
    {
      provide: MfaService,
      useFactory: () => new MfaService(authenticator),
    },
    {
      provide: 'JWT_SECRET',
      useFactory: (config: ConfigService) =>
        config.get('auth')?.jwt_secret || 'default_jwt_secret',
      inject: [ConfigService],
    },
    {
      provide: getRepositoryToken(UserEntity),
      useFactory: (ds: DataSource) => ds.getRepository(UserEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
    {
      provide: getRepositoryToken(TokenEntity),
      useFactory: (ds: DataSource) => ds.getRepository(TokenEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
    {
      provide: getRepositoryToken(KeyDatum),
      useFactory: (ds: DataSource) => ds.getRepository(KeyDatum),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
  ],
})
export class AppModule {}
