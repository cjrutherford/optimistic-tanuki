import { DataSource } from "typeorm";
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { NoteEntity, TaskEntity, TimerEntity } from "../entities";

const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')) as Record<string, any>;
const { database: {
    host,
    port,
    username,
    password,
    name,
    database
}} = config;

const entities = [TaskEntity, NoteEntity, TimerEntity];

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