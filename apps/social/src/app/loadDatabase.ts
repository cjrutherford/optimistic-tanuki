import { ConfigService } from "@nestjs/config";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Attachment } from "../entities/attachment.entity";
import { Post } from "../entities/post.entity";
import { Vote } from "../entities/vote.entity";
import { Link } from "../entities/link.entity";
import { Comment } from "../entities/comment.entity";
import FollowEntity from "../entities/Follow.entity";

const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    const entities = [Attachment, Comment, Post, Vote, Link, FollowEntity];
    const ormConfig: PostgresConnectionOptions = {
        type: 'postgres',
        host: database.host,
        port: database.port,
        username: database.username,
        password: database.password,
        database: database.database,
        entities
    };
    return ormConfig;
}

export default loadDatabase;