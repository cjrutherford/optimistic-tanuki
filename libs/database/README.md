<<<<<<< HEAD
# Database

This library contains services and entities for interacting with the database. It provides a convenient and consistent way to access and manipulate data.

## Usage

To use the services in this library, inject them into your NestJS services or controllers:

```typescript
import { DatabaseService } from '@optimistic-tanuki/database';

@Injectable()
export class MyService {
  constructor(private readonly databaseService: DatabaseService) {}
}
```
=======
# Database Module

A NestJS module for managing TypeORM database connections with automatic repository provisioning.
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)

## Overview

The Database module provides a simple way to configure TypeORM database connections in your NestJS applications. It automatically extracts entities from your database configuration and creates repository providers, eliminating the need for manual repository setup in your app modules.

## Features

- **Automatic Repository Registration**: Automatically creates and exports repository providers based on entities in your database configuration
- **Global Module**: Registered as a global module, making connections and repositories available throughout your application
- **Multiple Connections**: Supports registering multiple database connections in a single call
- **Type-Safe**: Uses TypeORM's `getRepositoryToken()` helper for type-safe repository injection

## Installation

This library is part of the `@optimistic-tanuki` monorepo and uses Nx for workspace management.

## Usage

### Basic Setup

1. **Create a database configuration factory**:

```typescript
// loadDatabase.ts
import { ConfigService } from "@nestjs/config";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { UserEntity } from "../entities/user.entity";
import { ProfileEntity } from "../entities/profile.entity";

const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    const entities = [UserEntity, ProfileEntity];
    
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
```

2. **Register the database module in your app module**:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import loadConfig from './config';
import { UserService } from './user.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'myapp',
      factory: loadDatabase,
    }),
  ],
  providers: [UserService],
})
export class AppModule {}
```

3. **Inject repositories in your services**:

```typescript
// user.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @Inject(getRepositoryToken(UserEntity))
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async findAll() {
    return this.userRepo.find();
  }
}
```

### Multiple Connections

You can register multiple database connections:

```typescript
DatabaseModule.register(
  {
    name: 'users',
    factory: loadUserDatabase,
  },
  {
    name: 'analytics',
    factory: loadAnalyticsDatabase,
  }
)
```

Each connection will be available as `{NAME}_CONNECTION` (e.g., `USERS_CONNECTION`, `ANALYTICS_CONNECTION`).

### What Gets Exported

For each registered connection, the module exports:
1. **Connection**: Available as `{NAME}_CONNECTION` token (e.g., `MYAPP_CONNECTION`)
2. **Repositories**: One repository provider for each entity in your configuration, using `getRepositoryToken(Entity)` as the injection token

### Migration from Manual Setup

**Before** (manual repository providers):
```typescript
@Module({
  imports: [DatabaseModule.register({ name: 'myapp', factory: loadDatabase })],
  providers: [
    UserService,
    {
      provide: getRepositoryToken(UserEntity),
      useFactory: (ds: DataSource) => ds.getRepository(UserEntity),
      inject: ['MYAPP_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ProfileEntity),
      useFactory: (ds: DataSource) => ds.getRepository(ProfileEntity),
      inject: ['MYAPP_CONNECTION'],
    }
  ],
})
export class AppModule {}
```

**After** (automatic repository providers):
```typescript
@Module({
  imports: [DatabaseModule.register({ name: 'myapp', factory: loadDatabase })],
  providers: [UserService],
})
export class AppModule {}
```

The repositories are now automatically created and exported by the DatabaseModule!

## API Reference

### `DatabaseModule.register(...opts)`

Registers one or more database connections.

**Parameters:**
- `opts`: Array of connection options
  - `name` (string): Connection name (will be uppercased and suffixed with `_CONNECTION`)
  - `factory` (function): Function that receives `ConfigService` and returns `DataSourceOptions`

**Returns:** `DynamicModule`

## Running Unit Tests

<<<<<<< HEAD
Run `nx test database` to execute the unit tests.
=======
Run `nx test database` to execute the unit tests via [Jest](https://jestjs.io).

## Additional Tools

The module also exports:
- `FindOptionsBuilder`: A utility for building TypeORM find options

```typescript
import { FindOptionsBuilder } from '@optimistic-tanuki/database';
```
>>>>>>> 53d2322 (Add comprehensive documentation and DRY analysis)
