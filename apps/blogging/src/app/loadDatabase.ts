import { ConfigService } from "@nestjs/config";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Post, Event, Contact } from "./entities";

const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    console.log(`Database configuration: ${JSON.stringify(database)}`);
    const entities = [Post, Event, Contact];
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