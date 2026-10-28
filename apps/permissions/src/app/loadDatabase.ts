import { DataSourceOptions } from 'typeorm';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { ConfigService } from '@nestjs/config';
import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
import { Initial1762976494195 } from '../../migrations/1762976494195-initial';
import { UpdateRoleAssignmentUniqueIndex1763070000000 } from '../../migrations/1763070000000-update-role-assignment-unique-index';
import { AccountDeletionWriteFence1792934694011 } from '../../migrations/1792934694011-AccountDeletionWriteFence';

export const loadDatabase = (config: ConfigService): DataSourceOptions => {
  const { host, port, username, password, database } = config.get('database');
  return {
    type: 'postgres',
    host: process.env.POSTGRES_HOST || host,
    port: Number(process.env['POSTGRES_PORT'] || port),
    connectTimeoutMS: 3000,
    username: process.env['POSTGRES_USER'] || username,
    password: process.env['POSTGRES_PASSWORD'] || password,
    database: process.env.POSTGRES_DB || database,
    entities: [
      Permission,
      Role,
      RoleAssignment,
      AppScope,
      AccountDeletionWriteFenceEntity,
    ],
    migrations: [
      Initial1762976494195,
      UpdateRoleAssignmentUniqueIndex1763070000000,
      AccountDeletionWriteFence1792934694011,
    ],
    migrationsRun: process.env.OT_RUN_MIGRATIONS_ON_START === 'true',
    synchronize: false,
  } as DataSourceOptions;
};

export default loadDatabase;
