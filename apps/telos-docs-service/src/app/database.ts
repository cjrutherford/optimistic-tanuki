import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { PersonaTelos, ProfileTelos, ProjectTelos } from './entities';

export default (configService: ConfigService): PostgresConnectionOptions => {
    // Unpack values from configService
    const host = configService.get<string>('database.host');
    const port = configService.get<string | number>('database.port');
    const username = configService.get<string>('database.username');
    const password = configService.get<string>('database.password');
    const database = configService.get<string>('database.database');

    // Parse values as needed
    const parsedPort = typeof port === 'string' ? parseInt(port, 10) : port;

    // Re-package into PostgresConnectionOptions
    const options: PostgresConnectionOptions = {
        type: 'postgres',
        host,
        port: parsedPort,
        username,
        password,
        database,
        entities: [ProfileTelos, ProjectTelos, PersonaTelos]
    };

    return options;
};
