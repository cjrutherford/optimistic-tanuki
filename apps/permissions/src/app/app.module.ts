import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { getRepositoryToken } from '@nestjs/typeorm';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { PermissionsService } from './permissions.service';
import { RolesService } from './roles.service';
import { AppScopesService } from './app-scopes.service';
import { PermissionsController } from '../permissions/permissions.controller';
import { RolesController } from '../roles/roles.controller';
import { AppScopesController } from '../app-scopes/app-scopes.controller';
import { AccountExportService } from './account-export.service';
import { AccountExportController } from './account-export.controller';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'permissions',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [
    PermissionsController,
    RolesController,
    AppScopesController,
    AccountExportController,
  ],
  providers: [
    PermissionsService,
    RolesService,
    AppScopesService,
    AccountExportService,
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
      useFactory: (config: ConfigService) => {
        const target = config.get<{ host: string; port: number }>(
          'services.authentication'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: target,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (config: ConfigService) => {
        const target = config.get<{ host: string; port: number }>(
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
      provide: getRepositoryToken(Permission),
      useFactory: (ds: DataSource) => ds.getRepository(Permission),
      inject: ['PERMISSIONS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Role),
      useFactory: (ds: DataSource) => ds.getRepository(Role),
      inject: ['PERMISSIONS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(RoleAssignment),
      useFactory: (ds: DataSource) => ds.getRepository(RoleAssignment),
      inject: ['PERMISSIONS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(AppScope),
      useFactory: (ds: DataSource) => ds.getRepository(AppScope),
      inject: ['PERMISSIONS_CONNECTION'],
    },
  ],
})
export class AppModule {}
