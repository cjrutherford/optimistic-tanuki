import { ConfigService } from "@nestjs/config";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Conversation, Message } from "./entities";

/**
 * Loads the database configuration for the Chat Collector microservice.
 * @param config The ConfigService instance.
 * @returns PostgresConnectionOptions for TypeORM.
 */
const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    console.log(`Database configuration: ${JSON.stringify(database)}`);
    const entities = [Message, Conversation];
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