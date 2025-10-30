import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  controllers: [PermissionsController, RolesController, AppScopesController],
  providers: [
    PermissionsService,
    RolesService,
    AppScopesService,
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
