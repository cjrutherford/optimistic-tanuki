import { Module } from '@nestjs/common';
import { AuthenticationController } from '../controllers/authentication/authentication.controller';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ProfileController } from '../controllers/profile/profile.controller';
import { SocialController } from '../controllers/social/social.controller';
import { AuthGuard } from '../auth/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { NotesController } from '../controllers/notes.controller';
import { TasksController } from '../controllers/tasks.controller';
import { TimersController } from '../controllers/timers.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TcpServiceConfig, loadConfig } from '../config';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { AssetController } from '../controllers/asset.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
  ],
  controllers: [
    AuthenticationController,
    ProfileController,
    SocialController,
    NotesController,
    TasksController,
    TimersController,
    AssetController,
  ],
  providers: [
    AuthGuard,
    JwtService,
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.authentication'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig.host,
            port: serviceConfig.port,
          },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.profile');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig.host,
            port: serviceConfig.port,
          },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.SOCIAL_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.social');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig.host,
            port: serviceConfig.port,
          },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.TASKS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>('services.tasks');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig.host,
            port: serviceConfig.port,
          },
        });
      },
      inject: [ConfigService],
    },{
      provide: ServiceTokens.ASSETS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>('services.asset');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig.host,
            port: serviceConfig.port,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
