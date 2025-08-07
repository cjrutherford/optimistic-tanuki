import { DataSource } from "typeorm";
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import AssetEntity from "../entities/asset.entity";

/**
 * Loads configuration from the assets config.yaml file.
 */
const config = yaml.load(fs.readFileSync(path.resolve('./src/assets/config.yaml'), 'utf8')) as Record<string, any>;
/**
 * Destructures database configuration from the loaded config.
 * @property {string} configHost - The database host from the config file.
 * @property {number} port - The database port.
 * @property {string} username - The database username.
 * @property {string} password - The database password.
 * @property {string} configName - The database name from the config file.
 * @property {string} configDatabase - The database name from the config file (alternative).
 */
const { database: {
    host: configHost, // Renamed to avoid conflict
    port,
    username,
    password,
    name: configName, // Renamed to avoid conflict
    database: configDatabase // Renamed to avoid conflict
}} = config;

/**
 * Determines the database host, prioritizing environment variable POSTGRES_HOST.
 */
const host = process.env.POSTGRES_HOST || configHost;
/**
 * Determines the database name, prioritizing environment variable POSTGRES_DB.
 */
const database = process.env.POSTGRES_DB || configDatabase || configName;

/**
 * Defines the entities to be used by TypeORM.
 */
const entities = [AssetEntity];

console.log(`Using database configuration: host=${host}, port=${port}, username=${username}, database=${database}`);
/**
 * Configures and exports a TypeORM DataSource for the Assets microservice.
 * This configuration is used for database migrations and direct database interactions.
 */
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