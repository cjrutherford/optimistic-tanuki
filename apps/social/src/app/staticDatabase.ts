import { DataSource } from "typeorm";
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { Post } from "../entities/post.entity";
import { Vote } from "../entities/vote.entity";
import { Comment } from "../entities/comment.entity";
import { Attachment } from "../entities/attachment.entity";
import { Link } from "../entities/link.entity";
import FollowEntity from "../entities/Follow.entity";

const config = yaml.load(fs.readFileSync(path.resolve(__dirname, '../assets/config.yaml'), 'utf8')) as Record<string, any>;
const { database: {
    host,
    port,
    username,
    password,
    name,
    database
}} = config;

const entities = [Post, Vote, Comment, Attachment, Link, FollowEntity];

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