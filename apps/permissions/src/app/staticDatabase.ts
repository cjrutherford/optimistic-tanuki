import * as yaml from 'js-yaml';

import { DataSource } from "typeorm";
import { Permission } from "../permissions/entities/permission.entity";
import { Role } from "../roles/entities/role.entity";
import { RoleAssignment } from "../role-assignments/entities/role-assignment.entity";
import { AppScope } from "../app-scopes/entities/app-scope.entity";
import fs from 'fs';
import path from 'path';

const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')) as Record<string, any>;
const { database: {
    host: configHost,
    port,
    username,
    password,
    name: configName,
    database: configDatabase
}} = config;

const host = process.env.POSTGRES_HOST || configHost;
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [Permission, Role, RoleAssignment, AppScope];

const staticSource = new DataSource({
    type: 'postgres',
    host: host,
    port: Number(port),
    username,
    password,
    database: database,
    entities,
    migrations: ['./migrations/*.ts'],
}); 
export default staticSource;
