import { DataSource } from "typeorm";
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { Profile } from "../profiles/entities/profile.entity";
import { Project } from "../projects/entities/project.entity";
import { Goal } from "../goals/entities/goal.entity";
import { Timeline } from "../timelines/entities/timeline.entity";

const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')) as Record<string, any>;
const { database: {
    host,
    port,
    username,
    password,
    name,
    database
}} = config;

const entities = [Profile, Project, Goal, Timeline];

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