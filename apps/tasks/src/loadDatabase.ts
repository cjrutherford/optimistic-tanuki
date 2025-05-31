import { ConfigService } from "@nestjs/config";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { NoteEntity, TaskEntity, TimerEntity } from "./entities";

const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    const entities = [TaskEntity, NoteEntity, TimerEntity];
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