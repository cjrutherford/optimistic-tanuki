import { DataSource } from "typeorm";
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { KeyDatum } from "../key-data/entities/key-datum.entity";
import { TokenEntity } from "../tokens/entities/token.entity";
import { UserEntity } from "../user/entities/user.entity";

const config = yaml.load(fs.readFileSync(path.resolve('./src/assets/config.yaml'), 'utf8')) as Record<string, any>;
const { database: {
    host,
    port,
    username,
    password,
    name,
    database
}} = config;

const entities = [KeyDatum, UserEntity, TokenEntity];

const staticSource =  new DataSource({
    type: 'postgres', 
    host: host,
    port: Number(port),
    username,
    password,
    database: database,
    entities,
    migrations: ['migrations/*.ts'],
}); 
export default staticSource