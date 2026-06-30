import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';

@Module({
  imports: [ConfigModule],
  controllers: [BootstrapController],
  providers: [
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
      useFactory: (configService: ConfigService): ClientProxy =>
        createTcpClient(
          configService,
          'admin-api.services.authentication.host',
          'admin-api.services.authentication.port'
        ),
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (configService: ConfigService): ClientProxy =>
        createTcpClient(
          configService,
          'admin-api.services.profile.host',
          'admin-api.services.profile.port'
        ),
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PERMISSIONS_SERVICE,
      useFactory: (configService: ConfigService): ClientProxy =>
        createTcpClient(
          configService,
          'admin-api.services.permissions.host',
          'admin-api.services.permissions.port'
        ),
      inject: [ConfigService],
    },
    RoleInitService,
    BootstrapService,
  ],
  exports: [BootstrapService],
})
export class BootstrapModule {}

function createTcpClient(
  configService: ConfigService,
  hostKey: string,
  portKey: string
): ClientProxy {
  return ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: configService.get<string>(hostKey) || '127.0.0.1',
      port: configService.get<number>(portKey) || 0,
    },
  });
}
