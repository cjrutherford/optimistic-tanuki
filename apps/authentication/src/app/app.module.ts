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
import { BootstrapController } from './bootstrap.controller';
import { AuthActionTokenEntity } from '../email-auth/entities/auth-action-token.entity';
import { EmailAuthService } from './email-auth.service';
import { GuardianPermissionEntity } from '../guardian-permissions/entities/guardian-permission.entity';
import { GuardianPermissionService } from '../guardian-permissions/guardian-permission.service';
import { GuardianPolicyNoticeService } from '../guardian-permissions/guardian-policy-notice.service';
import { GuardianPolicyNoticeEntity } from '../guardian-permissions/entities/guardian-policy-notice.entity';
import { AccountExportService } from './account-export.service';
import { AccountExportController } from './account-export.controller';
import { AccountExportJobService } from '../account-export-jobs/account-export-job.service';
import { AccountExportJobEntity } from '../account-export-jobs/entities/account-export-job.entity';
import { AuthenticationAccountExportOwnerService } from '../account-export-owner/account-export-owner.service';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';

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
          const smtpSecure = config.get<string | boolean>('SMTP_SECURE');
          return {
            providers: [
              new SmtpEmailProvider({
                host: smtpHost,
                port: Number(config.get<string | number>('SMTP_PORT') || 465),
                secure: smtpSecure === true || smtpSecure === 'true',
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
        return { providers: [new ConsoleEmailProvider()] };
      },
    }),
  ],
  controllers: [AppController, BootstrapController, AccountExportController],
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
    AccountExportService,
    AccountExportOwnerSpoolService,
    {
      provide: AuthenticationAccountExportOwnerService,
      useFactory: (dataSource: DataSource, auth: AppService) =>
        new AuthenticationAccountExportOwnerService(dataSource, auth),
      inject: ['AUTHENTICATION_CONNECTION', AppService],
    },
    AccountExportJobService,
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const target = configService.get<{ host: string; port: number }>(
          'services.profile'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: target,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PERMISSIONS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const target = configService.get<{ host: string; port: number }>(
          'services.permissions'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: target,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.SOCIAL_SERVICE,
      useFactory: (configService: ConfigService) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: configService.get<{ host: string; port: number }>(
            'services.social'
          ),
        }),
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.FORUM_SERVICE,
      useFactory: (configService: ConfigService) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: configService.get<{ host: string; port: number }>(
            'services.forum'
          ),
        }),
      inject: [ConfigService],
    },
    OAuthService,
    OAuthConfigValidator,
    EmailAuthService,
    GuardianPermissionService,
    GuardianPolicyNoticeService,
    SaltedHashService,
    PasswordPolicyService,
    KeyService,
    AsymmetricService,
    {
      provide: 'EMAIL_PASSWORD_TOOLS',
      useFactory: (
        policy: PasswordPolicyService,
        hashing: SaltedHashService
      ) => ({
        ensurePasswordConfirmation: (password: string, confirmation: string) =>
          policy.ensurePasswordConfirmation(password, confirmation),
        createNewHash: (password: string) => hashing.createNewHash(password),
      }),
      inject: [PasswordPolicyService, SaltedHashService],
    },
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
          config.get('auth')?.jwt_secret || 'default_jwt_secret'
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
      provide: getRepositoryToken(AuthActionTokenEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AuthActionTokenEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
    {
      provide: getRepositoryToken(GuardianPermissionEntity),
      useFactory: (ds: DataSource) =>
        ds.getRepository(GuardianPermissionEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
    {
      provide: getRepositoryToken(GuardianPolicyNoticeEntity),
      useFactory: (ds: DataSource) =>
        ds.getRepository(GuardianPolicyNoticeEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
    {
      provide: getRepositoryToken(OAuthProviderEntity),
      useFactory: (ds: DataSource) => ds.getRepository(OAuthProviderEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AccountExportJobEntity),
      useFactory: (ds: DataSource) => ds.getRepository(AccountExportJobEntity),
      inject: ['AUTHENTICATION_CONNECTION'],
    },
  ],
})
export class AppModule {}
