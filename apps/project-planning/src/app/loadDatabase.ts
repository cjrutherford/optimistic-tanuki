import { ConfigService } from "@nestjs/config";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Project } from "./entities/project.entity";
import { Task } from "./entities/task.entity";
import { Risk } from "./entities/risk.entity";
import { Change } from "./entities/change.entity";
import { Timer } from "./entities/timer.entity";
import { ProjectJournal } from "./entities/project-journal.entity";

const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    console.log(`Database configuration: ${JSON.stringify(database)}`);
    const entities = [Project, Task, Risk, Change, Timer, ProjectJournal];
    console.log(`Using database configuration: host=${database.host}, port=${database.port}, username=${database.username}, database=${database.database}`);
    const ormConfig: PostgresConnectionOptions = {
        type: 'postgres',
        host: database.host,
        port: database.port,
        username: database.username,
        password: database.password,
        database: database.database || database.name,
        entities
    };
    return ormConfig;
}

export default loadDatabase;