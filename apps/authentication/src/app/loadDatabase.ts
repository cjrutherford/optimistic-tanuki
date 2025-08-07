import { ConfigService } from "@nestjs/config";
import { KeyDatum } from "../key-data/entities/key-datum.entity";
import { UserEntity } from "../user/entities/user.entity";
import { TokenEntity } from "../tokens/entities/token.entity";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

/**
 * Loads the database configuration for the Authentication microservice.
 * @param config The ConfigService instance.
 * @returns PostgresConnectionOptions for TypeORM.
 */
const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    console.log(`Database configuration: ${JSON.stringify(database)}`);
    const entities = [KeyDatum, UserEntity, TokenEntity];
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