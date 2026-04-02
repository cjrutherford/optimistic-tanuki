# HOPEFUL ASPIRATIONS — Project Rules for LLMs

## Purpose

Guidelines for LLMs (and developers) working on the Optimistic Tanuki repository. Ensures consistency, quality, and adherence to established patterns.

---

## Repository Overview

- **Type:** Nx monorepo
- **Package Manager:** pnpm
- **Frontend:** Angular 17+ (standalone components)
- **Backend:** NestJS (microservices + gateway)
- **Database:** PostgreSQL
- **Testing:** Jest (unit), Playwright (E2E)
- **CI/CD:** GitHub Actions
- **License:** MIT

---

## Architecture Rules

### Rule 1: Microservices Pattern

- **Every backend service** must be a NestJS microservice using TCP transport
- **Never** create a standalone HTTP server for a domain service
- **All HTTP traffic** goes through the existing gateway (port 3000)
- Services communicate via `ClientProxy` with `@MessagePattern`

### Rule 2: Gateway is the Single Entry Point

- The gateway is the **only** HTTP-facing service
- All new domain services register their controllers in the gateway
- Gateway controllers proxy to microservices via TCP
- No service has its own HTTP endpoints for external access

### Rule 3: Configuration Pattern

- **Primary config:** YAML file loaded via `ConfigModule.forRoot()`
- **Overrides:** Environment variables override YAML values
- **Pattern:**

  ```typescript
  // In config.ts
  export const loadConfig = () => ({
    services: {
      social: {
        host: process.env.SOCIAL_HOST || 'localhost',
        port: Number(process.env.SOCIAL_PORT) || 3002,
      },
    },
  });
  ```

- **Never** hardcode configuration values

### Rule 4: Service Tokens

- **Every service** must have a ServiceToken defined in `libs/constants`
- Service tokens are strings that identify services for dependency injection
- Format: `SERVICE_NAME_SERVICE` (e.g., `HARDWARE_SERVICE`, `LEAD_SERVICE`)

### Rule 5: Commands Pattern

- **Every action** a service can perform must have a command defined in `libs/constants`
- Commands are used with `@MessagePattern({ cmd: CommandName })`
- Format: `entity.action` (e.g., `lead.create`, `hardware.calculatePrice`)

---

## Code Style Rules

### Rule 6: TypeScript

- Use TypeScript strict mode
- Use interfaces for data models (not classes)
- Use enums for fixed values (status, type, etc.)
- Use DTOs with `class-validator` decorators for input validation
- Export everything from barrel files (`index.ts`)

### Rule 7: NestJS Patterns

- Controllers handle HTTP/gateway concerns only
- Services contain business logic
- Use `@Inject(ServiceTokens.X)` for microservice communication
- Use `firstValueFrom()` to convert Observable to Promise
- Use guards for authentication and permissions
- Use decorators for permission requirements

### Rule 8: Angular Patterns

- **Always** use standalone components
- Use lazy loading for routes (`loadComponent`)
- Use inline templates and styles for small components
- Use HttpClient for API communication
- Import shared UI libraries, don't recreate components

---

## File Organization Rules

### Rule 9: Apps Directory

Each app must have:

- `src/main.ts` — Entry point
- `src/app/app.module.ts` — NestJS module
- `src/controllers/` — Controllers (domain folders)
- `src/services/` — Business logic
- `project.json` — Nx project config
- `jest.config.ts` — Test config
- `tsconfig.app.json` — TypeScript config

### Rule 10: Libs Directory

Each lib must have:

- `src/index.ts` — Barrel export
- Clear, single responsibility
- No circular dependencies

### Rule 11: Models (libs/models)

- Models go in `libs/models/src/lib/libs/[domain]/`
- Each domain has its own folder
- Export from barrel file
- Include: models, enums, DTOs

### Rule 12: Constants (libs/constants)

- Commands go in `libs/constants/src/lib/libs/[domain]/`
- Service tokens in `libs/constants/src/lib/libs/service.tokens.ts`
- Export from barrel file

---

## Naming Conventions

### Rule 13: Files

- Controllers: `[entity].controller.ts`
- Services: `[entity].service.ts`
- Models: `[entity].model.ts`
- DTOs: `create-[entity].dto.ts`, `update-[entity].dto.ts`
- Enums: `[entity]-[type].enum.ts`
- Commands: `[domain]-commands.ts`

### Rule 14: Code

- Classes: PascalCase (`LeadsController`)
- Interfaces: PascalCase (`Lead`, `CreateLeadDto`)
- Enums: PascalCase (`LeadStatus`)
- Enum values: UPPER_SNAKE_CASE (`NEW`, `CONTACTED`)
- Variables/functions: camelCase (`findAll`, `createLead`)
- Commands: `entity.action` (`lead.create`, `hardware.validateConfig`)

---

## Testing Rules

### Rule 15: Unit Tests

- Every controller must have a `.spec.ts` file
- Every service should have a `.spec.ts` file
- Mock external dependencies (ClientProxy, database)
- Test happy path and error cases
- Use Jest (`describe`, `it`, `expect`)

### Rule 16: E2E Tests

- Create `-e2e` app for each new app
- Use Playwright for frontend testing
- Test full request flow (HTTP → Gateway → Service → DB)
- Tests run in CI/CD

---

## API Rules

### Rule 17: REST Endpoints

- Use standard HTTP methods (GET, POST, PUT, DELETE)
- Plural nouns for collections (`/leads`, `/hardware/chassis`)
- IDs in path (`/leads/:id`)
- Filters as query params (`/leads?status=new`)
- Use Swagger decorators (`@ApiOperation`, `@ApiResponse`)

### Rule 18: Error Handling

- Throw NestJS exceptions (`NotFoundException`, `BadRequestException`)
- Use try/catch in controllers for microservice errors
- Return consistent error format
- Log errors with Logger

### Rule 19: Validation

- Use ValidationPipe with whitelist mode
- All DTOs must have validation decorators
- Reject unknown properties
- Auto-transform types

---

## Permission Rules

### Rule 20: Permission Format

- Format: `domain.action` (e.g., `leads.read`, `hardware.orders.create`)
- Define in `libs/constants/src/lib/libs/permissions.ts`
- Use `@RequirePermissions()` decorator on controller methods
- Use `PermissionsGuard` on controllers

### Rule 21: Public Endpoints

- Mark public endpoints with `@Public()` decorator
- Customer-facing pricing endpoints are public
- Chassis/component browsing is public
- Order creation may require auth

---

## Database Rules

### Rule 22: Migrations

- Use TypeORM migrations for schema changes
- Never modify production schema manually
- Migrations must be reversible
- Test migrations in development first

### Rule 23: Queries

- Use repository pattern (TypeORM)
- Avoid raw SQL unless necessary
- Use transactions for multi-step operations
- Index frequently queried columns

---

## Documentation Rules

### Rule 24: Code Documentation

- Swagger decorators on all endpoints
- JSDoc on complex functions
- README for each app
- Architecture docs in `docs/` folder

### Rule 25: Commit Messages

- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`
- Example: `feat(hardware): add chassis controller`

---

## Common Mistakes to Avoid

### ❌ Don't

- Create standalone HTTP servers for domain services
- Hardcode configuration values
- Skip validation on DTOs
- Create new UI libraries when existing ones work
- Use `any` type
- Skip unit tests
- Ignore TypeScript errors

### ✅ Do

- Use microservices with TCP
- Use config + env variables
- Validate all inputs
- Reuse existing UI libraries
- Use proper TypeScript types
- Write tests
- Fix TypeScript errors

---

## Quick Reference

### Creating a New Microservice

**Use Nx tooling to generate all new code.** Never create files manually.

1. Generate the app:

   ```bash
   nx generate @nx/node:application [name] --directory=apps/[name]
   ```

2. Convert to microservice in `main.ts`:

   ```typescript
   import { MicroserviceOptions, Transport } from '@nestjs/microservices';
   // ... microservice bootstrap pattern
   ```

3. Add commands to `libs/constants`
4. Add models to `libs/models`
5. Register in gateway module (add controller + service provider)
6. Add config to gateway `config.ts`
7. Generate E2E test app:

   ```bash
   nx generate @nx/playwright:configuration [name]-e2e
   ```

8. Add to `docker-compose.yml`

### Adding a New Endpoint

1. Define command in `libs/constants`
2. Add `@MessagePattern` in microservice controller
3. Add HTTP controller in gateway with `@Inject(ServiceTokens.X)`
4. Use `firstValueFrom()` to proxy
5. Add Swagger decorators
6. Add permission if needed
7. Write unit tests

---

## File Templates

### Microservice main.ts

```typescript
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

export async function bootstrap() {
  const configApp = await NestFactory.create(AppModule);
  const config = configApp.get(ConfigService);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: Number(config.get('listenPort')) || 3001,
    },
  });
  await app.listen().then(() => {
    Logger.log('Service listening on port: ' + (config.get('listenPort') || 3001));
  });
}
bootstrap();
```

### Gateway Controller

```typescript
import { Controller, Get, Post, Body, Inject, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens, DomainCommands } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('domain')
export class DomainController {
  constructor(
    @Inject(ServiceTokens.DOMAIN_SERVICE)
    private readonly domainClient: ClientProxy
  ) {}

  @Get()
  @RequirePermissions('domain.read')
  async findAll() {
    return firstValueFrom(this.domainClient.send({ cmd: DomainCommands.FIND_ALL }, {}));
  }
}
```

### Microservice Controller

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DomainService } from '../../services/domain.service';
import { DomainCommands } from '@optimistic-tanuki/models';

@Controller()
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @MessagePattern({ cmd: DomainCommands.FIND_ALL })
  async findAll() {
    return this.domainService.findAll();
  }
}
```

---

_Project Rules v1.0_  
_March 2026_  
_Optimistic Tanuki_
