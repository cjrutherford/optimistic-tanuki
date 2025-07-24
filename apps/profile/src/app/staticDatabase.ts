import * as yaml from 'js-yaml';

import { DataSource } from "typeorm";
import { Profile } from "../profiles/entities/profile.entity";
import { Timeline } from "../timelines/entities/timeline.entity";
import fs from 'fs';
import path from 'path';

const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')) as Record<string, any>;
const { database: {
    host: configHost, // Renamed to avoid conflict
    port,
    username,
    password,
    name: configName, // Renamed to avoid conflict
    database: configDatabase // Renamed to avoid conflict
}} = config;

// Use environment variable for host if available, otherwise use configHost
const host = process.env.POSTGRES_HOST || configHost;
// Use environment variable for database name if available, otherwise use configDatabase or configName
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [Profile, Timeline];

const staticSource =  new DataSource({
    type: 'postgres',
    host: host, // Use the potentially overridden host
    port: Number(port),
    username,
    password,
    database: database, // Use the potentially overridden database name
    entities,
    migrations: ['./migrations/*.ts'],
}); 
export default staticSource