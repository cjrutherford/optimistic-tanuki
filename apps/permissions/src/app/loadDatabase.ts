import { DataSource } from "typeorm";
import { Permission } from "../permissions/entities/permission.entity";
import { Role } from "../roles/entities/role.entity";
import { RoleAssignment } from "../role-assignments/entities/role-assignment.entity";
import { AppScope } from "../app-scopes/entities/app-scope.entity";

export const loadDatabase = (config: any): DataSource => {
    const { host, port, username, password, database } = config.database;
    return new DataSource({
        type: 'postgres',
        host: process.env.POSTGRES_HOST || host,
        port: Number(port),
        username,
        password,
        database: process.env.POSTGRES_DB || database,
        entities: [Permission, Role, RoleAssignment, AppScope],
        synchronize: false,
    });
}

export default loadDatabase;
