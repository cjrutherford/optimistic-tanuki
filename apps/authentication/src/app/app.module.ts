import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  MfaService,
  PasswordPolicyService,
  TokenIssuerService,
} from '@optimistic-tanuki/auth-domain';
import { DatabaseModule } from '@optimistic-tanuki/database';
import {
  AsymmetricService,
  SaltedHashService,
} from '@optimistic-tanuki/encryption';
import { LoggerModule } from '@optimistic-tanuki/logger';
import {
  EmailModule,
  ConsoleEmailProvider,
  SmtpEmailProvider,
} from '@optimistic-tanuki/email';
import { authenticator } from 'otplib';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { UserEntity } from '../user/entities/user.entity';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OAuthService } from './oauth.service';
import { KeyService } from './key.service';
import { OAuthConfigValidator } from './oauth-config.validator';
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
    EmailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const smtpHost = config.get<string>('SMTP_HOST');
        if (smtpHost) {
          return {
            providers: [
              new SmtpEmailProvider({
                host: smtpHost,
                port: config.get<number>('SMTP_PORT') || 587,
                secure: config.get<boolean>('SMTP_SECURE') || false,
                auth: {
                  user: config.get<string>('SMTP_USER') || '',
                  pass: config.get<string>('SMTP_PASS') || '',
                },
                defaultFrom:
                  config.get<string>('SMTP_FROM') ||
                  'noreply@optimistic-tanuki.dev',
              }),
            ],
          };
        }
        // Default to console provider for development
        return { providers: [new ConsoleEmailProvider()] };
      },
    }),
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
    OAuthService,
    OAuthConfigValidator,
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
      provide: TokenIssuerService,
      useFactory: (jwtService: JwtService, config: ConfigService) =>
        new TokenIssuerService(
          {
            sign: (payload, options) => jwtService.sign(payload, options),
          },
          config.get('auth')?.jwt_secret || 'default_jwt_secret',
        ),
      inject: [JwtService, ConfigService],
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
    {
      provide: getRepositoryToken(OAuthProviderEntity),
      useFactory: (ds: DataSource) => ds.getRepository(OAuthProviderEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
  ],
})
export class AppModule {}
