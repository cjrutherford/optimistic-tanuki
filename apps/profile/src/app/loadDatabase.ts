import { ConfigService } from "@nestjs/config";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Goal } from "../goals/entities/goal.entity";
import { Profile } from "../profiles/entities/profile.entity";
import { Project } from "../projects/entities/project.entity";
import { Timeline } from "../timelines/entities/timeline.entity";

const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    const entities = [Goal, Profile, Project, Timeline];
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