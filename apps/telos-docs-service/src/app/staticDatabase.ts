import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { PersonaTelos, ProfileTelos, ProjectTelos } from './entities';


const config = yaml.load(fs.readFileSync(path.resolve('./src/assets/config.yaml'), 'utf8')) as Record<string, any>;

const {
    database: {
        host: configHost,
        port,
        username,
        password,
        name: configName,
        database: configDatabase,
    }
} = config;

const host = process.env.POSTGRES_HOST || configHost;
const database = process.env.POSTGRES_DB || configDatabase;

const entities = [ ProfileTelos, PersonaTelos, ProjectTelos ];

const staticSource: DataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities,
    migrations: ['./migrations/*.ts']
});

export default staticSource;