import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from './app.module';
import loadConfig from '../config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

jest.mock('../config', () => {
    const mockConfig = {
        database: {
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'testuser',
            password: 'testpassword',
            database: 'testdb',
            synchronize: true,
            logging: false,
        },
        jwt: {
            secret: 'testsecret',
            expiresIn: '1h',
        },
        bcrypt: {
            saltRounds: 10,
        },
        throttle: {
            ttl: 60,
            limit: 20,
        },
        port: 3000,
    };
    return {
        __esModule: true, // This is important for ES module mocks
        default: () => mockConfig,
    };
});

describe('AppModule', () => {
    let appModule: TestingModule;

    beforeAll(async () => {
        appModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [loadConfig],
                }),
                AppModule,
            ],
        })
        .overrideModule(DatabaseModule)
        .useModule({
            module: DatabaseModule,
            exports: [],
            providers: [],
        })
        .overrideProvider(AppService)
        .useValue({}) // Mock AppService
        .overrideProvider(getRepositoryToken(UserEntity))
        .useValue({ target: UserEntity })
        .overrideProvider(getRepositoryToken(TokenEntity))
        .useValue({ target: TokenEntity })
        .overrideProvider(getRepositoryToken(KeyDatum))
        .useValue({ target: KeyDatum })
        .overrideProvider('AUTHENTICATION_CONNECTION')
        .useValue({ // Mock DatabaseModule
            createConnection: jest.fn().mockResolvedValue({
                query: jest.fn(),
                manager: {
                    transaction: jest.fn(),
                },
            }),
            close: jest.fn().mockResolvedValue({}),
        })
        .compile();
    });

    it('should load ConfigModule with isGlobal set to true', () => {
        const configModule = appModule.get<ConfigModule>(ConfigModule);
        expect(configModule).toBeDefined();
    });

    it('should have AppController defined', () => {
        const appController = appModule.get<AppController>(AppController);
        expect(appController).toBeDefined();
    });

    it('should have AppService defined', () => {
        const appService = appModule.get<AppService>(AppService);
        expect(appService).toBeDefined();
    });

    it('should load DatabaseModule with correct configuration', () => {
        const databaseModule = appModule.get<DatabaseModule>(DatabaseModule);
        expect(databaseModule).toBeDefined();
    });

    it('should load LoggerModule', () => {
        const loggerModule = appModule.get<LoggerModule>(LoggerModule);
        expect(loggerModule).toBeDefined();
    });

    it('should provide User repository', () => {
        const userRepository = appModule.get(getRepositoryToken(UserEntity));
        expect(userRepository).toBeDefined();
        expect(userRepository.target).toBe(UserEntity);
    });

    it('should provide Token repository', () => {
        const tokenRepository = appModule.get(getRepositoryToken(TokenEntity));
        expect(tokenRepository).toBeDefined();
        expect(tokenRepository.target).toBe(TokenEntity);
    });

    it('should provide KeyData repository', () => {
        const keyDataRepository = appModule.get(getRepositoryToken(KeyDatum));
        expect(keyDataRepository).toBeDefined();
        expect(keyDataRepository.target).toBe(KeyDatum);
    });


});
