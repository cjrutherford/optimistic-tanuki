import { DataSourceOptions } from 'typeorm';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { ConfigService } from '@nestjs/config';
import { Initial1762976494195 } from '../../migrations/1762976494195-initial';
import { UpdateRoleAssignmentUniqueIndex1763070000000 } from '../../migrations/1763070000000-update-role-assignment-unique-index';

export const loadDatabase = (config: ConfigService): DataSourceOptions => {
  const { host, port, username, password, database } = config.get('database');
  return {
    type: 'postgres',
    host: process.env.POSTGRES_HOST || host,
    port: Number(port),
    username,
    password,
    database: process.env.POSTGRES_DB || database,
    entities: [Permission, Role, RoleAssignment, AppScope],
    migrations: [
      Initial1762976494195,
      UpdateRoleAssignmentUniqueIndex1763070000000,
    ],
    migrationsRun: process.env.OT_RUN_MIGRATIONS_ON_START === 'true',
    synchronize: false,
  } as DataSourceOptions;
};

export default loadDatabase;
