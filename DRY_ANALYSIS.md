# DRY (Don't Repeat Yourself) Analysis for Optimistic Tanuki

This document identifies areas in the codebase where repetitive patterns exist and suggests refactoring opportunities for a more DRY implementation.

## Executive Summary

The recent database module refactoring successfully eliminated repository provider boilerplate across all applications. This analysis identifies additional areas where similar improvements can be made.

## Areas Successfully Refactored ✅

### 1. Database Repository Providers
**Status**: ✅ COMPLETED

**Before**: Each application manually created repository providers:
```typescript
{
  provide: getRepositoryToken(Entity),
  useFactory: (ds: DataSource) => ds.getRepository(Entity),
  inject: ['CONNECTION_NAME'],
}
```

**After**: Automatically handled by DatabaseModule:
```typescript
DatabaseModule.register({ name: 'myapp', factory: loadDatabase })
```

**Impact**: 
- Removed ~2-6 repository provider definitions per app (8 apps total)
- Reduced code duplication by approximately 100+ lines
- Improved maintainability and reduced error potential

## Areas Requiring Refactoring 🔴

### 1. Database Configuration Factory Functions

**Location**: `apps/*/src/app/loadDatabase.ts`

**Issue**: Nearly identical `loadDatabase` functions exist in every application:
```typescript
const loadDatabase = (config: ConfigService) => {
    const database = config.get('database');
    const entities = [/* app-specific entities */];
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
```

**Recommendation**: Create a shared factory function in the database library:
```typescript
// In @optimistic-tanuki/database
export function createPostgresConfig(
  config: ConfigService,
  entities: any[]
): PostgresConnectionOptions {
  const database = config.get('database');
  return {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities
  };
}

// In apps
const loadDatabase = (config: ConfigService) => 
  createPostgresConfig(config, [UserEntity, ProfileEntity]);
```

**Impact**: 
- Reduce ~15 lines per app to ~2 lines
- Centralize database configuration logic
- Easier to add new connection options globally

---

### 2. Application Module Structure

**Location**: `apps/*/src/app/app.module.ts`

**Issue**: Similar module import patterns across applications:
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({ name: 'app', factory: loadDatabase }),
    LoggerModule,
  ],
  // ...
})
```

**Recommendation**: Create a base module factory:
```typescript
// In a shared library
export function createBaseAppModule(options: {
  name: string;
  loadConfig: () => any;
  loadDatabase: (config: ConfigService) => DataSourceOptions;
  controllers?: Type<any>[];
  providers?: Provider[];
  additionalImports?: any[];
}) {
  return {
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [options.loadConfig],
      }),
      DatabaseModule.register({ 
        name: options.name, 
        factory: options.loadDatabase 
      }),
      LoggerModule,
      ...(options.additionalImports || []),
    ],
    controllers: options.controllers || [],
    providers: options.providers || [],
  };
}
```

**Impact**: 
- Standardize application setup
- Reduce boilerplate by ~50%
- Ensure consistency across apps

---

### 3. Entity Import Patterns

**Location**: Various service files

**Issue**: Repetitive entity imports and repository injections:
```typescript
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entity } from './entities/entity.entity';

constructor(
  @Inject(getRepositoryToken(Entity))
  private readonly entityRepo: Repository<Entity>,
) {}
```

**Recommendation**: Create a decorator for repository injection:
```typescript
// In @optimistic-tanuki/database
export function InjectRepository(entity: any) {
  return Inject(getRepositoryToken(entity));
}

// Usage
constructor(
  @InjectRepository(Entity)
  private readonly entityRepo: Repository<Entity>,
) {}
```

**Impact**:
- Reduce 2 imports to 1
- Cleaner, more readable code
- Less coupling to TypeORM specifics

---

### 4. Config Loading Pattern

**Location**: `apps/*/src/config.ts` or `apps/*/src/app/config.ts`

**Issue**: Config loading logic is inconsistent across apps. Some use default exports, some use named exports:
```typescript
// Pattern 1
export default () => ({ /* config */ });

// Pattern 2
export const loadConfig = () => ({ /* config */ });

// Pattern 3
const loadConfig = () => ({ /* config */ });
export default loadConfig;
```

**Recommendation**: Standardize on a single pattern:
```typescript
// Recommended pattern
export const loadConfig = () => ({
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'app_db',
  },
  // ... app-specific config
});
```

**Impact**:
- Improved code consistency
- Easier to understand and maintain
- Better IDE support

---

### 5. Environment Variable Handling

**Location**: Config files across all apps

**Issue**: Repeated environment variable parsing logic:
```typescript
port: parseInt(process.env.DB_PORT || '5432')
host: process.env.DB_HOST || 'localhost'
```

**Recommendation**: Create environment variable utilities:
```typescript
// In @optimistic-tanuki/constants or new @optimistic-tanuki/config library
export class EnvHelper {
  static getInt(key: string, defaultValue: number): number {
    return parseInt(process.env[key] || String(defaultValue));
  }
  
  static getString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }
  
  static getBool(key: string, defaultValue: boolean): boolean {
    return process.env[key]?.toLowerCase() === 'true' || defaultValue;
  }
}

// Usage
port: EnvHelper.getInt('DB_PORT', 5432)
host: EnvHelper.getString('DB_HOST', 'localhost')
```

**Impact**:
- Type-safe environment variable access
- Consistent parsing logic
- Single source of truth for defaults

---

### 6. Service CRUD Patterns

**Location**: Service files across applications

**Issue**: Many services implement similar CRUD operations:
```typescript
async findAll() {
  return this.repo.find();
}

async findOne(id: string) {
  return this.repo.findOne({ where: { id } });
}

async create(dto: CreateDto) {
  const entity = this.repo.create(dto);
  return this.repo.save(entity);
}

async update(id: string, dto: UpdateDto) {
  await this.repo.update(id, dto);
  return this.findOne(id);
}

async remove(id: string) {
  return this.repo.delete(id);
}
```

**Recommendation**: Create a base CRUD service class:
```typescript
// In @optimistic-tanuki/database
export abstract class CrudService<Entity> {
  constructor(protected readonly repository: Repository<Entity>) {}

  async findAll(): Promise<Entity[]> {
    return this.repository.find();
  }

  async findOne(id: string): Promise<Entity | null> {
    return this.repository.findOne({ where: { id } as any });
  }

  async create(dto: DeepPartial<Entity>): Promise<Entity> {
    const entity = this.repository.create(dto);
    return this.repository.save(entity);
  }

  async update(id: string, dto: DeepPartial<Entity>): Promise<Entity | null> {
    await this.repository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}

// Usage
@Injectable()
export class UserService extends CrudService<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    repo: Repository<UserEntity>,
  ) {
    super(repo);
  }
  
  // Add custom methods as needed
}
```

**Impact**:
- Eliminate 20-30 lines of boilerplate per service
- Standardize CRUD operations
- Focus service code on business logic

---

### 7. DTO Validation Patterns

**Location**: DTOs across applications

**Issue**: Repetitive validation decorators and patterns:
```typescript
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

**Recommendation**: Create reusable validation decorator combinations:
```typescript
// In a shared library
export function IsRequiredString() {
  return applyDecorators(IsString(), IsNotEmpty());
}

export function IsRequiredEmail() {
  return applyDecorators(IsEmail(), IsNotEmpty());
}

export function IsStrongPassword(minLength = 8) {
  return applyDecorators(
    IsString(),
    MinLength(minLength),
    Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'Password must contain uppercase, lowercase, and numbers'
    })
  );
}

// Usage
export class CreateUserDto {
  @IsRequiredString()
  name: string;

  @IsRequiredEmail()
  email: string;

  @IsStrongPassword()
  password: string;
}
```

**Impact**:
- Reduce decorator count from 2-3 to 1
- Enforce consistent validation rules
- Centralize validation logic

---

### 8. API Response Formatting

**Location**: Controllers across applications

**Issue**: Inconsistent response formatting:
```typescript
// Some controllers return raw data
return this.service.findAll();

// Others wrap in objects
return { data: this.service.findAll() };

// Others add metadata
return { data: this.service.findAll(), count: data.length };
```

**Recommendation**: Create a standard response interceptor:
```typescript
// In a shared library
export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    count?: number;
  };
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          ...(Array.isArray(data) ? { count: data.length } : {}),
        },
      })),
    );
  }
}
```

**Impact**:
- Consistent API responses
- Automatic metadata inclusion
- Easier API documentation

---

## Priority Recommendations

### High Priority (Immediate Impact)
1. **Database Configuration Factory** - Easy win, affects all apps
2. **InjectRepository Decorator** - Simple, widely used
3. **Config Loading Standardization** - Improves consistency

### Medium Priority (Significant Improvement)
4. **CRUD Service Base Class** - Larger refactor, high value
5. **Environment Variable Helpers** - Improves type safety
6. **Application Module Factory** - Standardizes setup

### Low Priority (Nice to Have)
7. **Validation Decorator Combinations** - Quality of life improvement
8. **API Response Formatting** - Can be phased in gradually

## Implementation Strategy

1. **Phase 1**: Implement database config factory and InjectRepository decorator
2. **Phase 2**: Create CRUD service base class and refactor 1-2 services as proof of concept
3. **Phase 3**: Standardize config loading and environment handling
4. **Phase 4**: Implement remaining recommendations based on team feedback

## Metrics

### Current State (Post Database Module Refactor)
- Lines of repeated code: ~500-700 lines
- Number of apps with similar patterns: 8
- Average lines per app module: 40-80 lines

### Projected State (After All Recommendations)
- Lines of repeated code: ~100-200 lines
- Reduction: 60-70%
- Average lines per app module: 20-30 lines

## Conclusion

The database module refactoring was a successful first step in reducing code duplication. The recommendations in this document represent the next phase of DRY improvements, focusing on configuration, service patterns, and standardization. Implementing these changes will significantly improve code maintainability, reduce bugs, and speed up development of new features.

## Notes

- This analysis was generated as part of the database module refactoring task
- Recommendations should be reviewed and prioritized by the team
- Some recommendations may require breaking changes and should be versioned appropriately
- Consider creating a separate epic/project for implementing these improvements
