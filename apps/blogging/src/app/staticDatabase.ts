import { DataSource } from "typeorm";
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { Post } from "./entities/post.entity";
import { Event } from "./entities/event.entity";
import { Contact } from "./entities/contact.entity";
import { Blog } from "./entities";

const config = yaml.load(fs.readFileSync(path.resolve('./src/assets/config.yaml'), 'utf8')) as Record<string, any>;
const { database: {
    host: configHost,
    port,
    username,
    password,
    name: configName,
    database: configDatabase
}} = config;
console.log(fs.readdirSync('.'))
// Use environment variable for host if available, otherwise use configHost
const host = process.env.POSTGRES_HOST || configHost;
// Use environment variable for database name if available, otherwise use configDatabase or configName
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [Post, Event, Contact, Blog];

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