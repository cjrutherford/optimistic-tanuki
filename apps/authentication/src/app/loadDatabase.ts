import { ConfigService } from "@nestjs/config";
import { KeyDatum } from "../key-data/entities/key-datum.entity";
import { UserEntity } from "../user/entities/user.entity";
import { TokenEntity } from "../tokens/entities/token.entity";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    const entities = [KeyDatum, UserEntity, TokenEntity];
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