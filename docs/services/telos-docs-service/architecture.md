# Telos Docs Service Architecture

`telos-docs-service` is a Nest TCP microservice that stores and serves Telos-oriented documentation data across persona, profile, and project domains.

## Main Responsibilities

- maintain persona-oriented Telos data
- maintain profile-oriented Telos data
- maintain project-oriented Telos data
- expose those domain slices through dedicated controllers and services
- support data seeding and benchmark-oriented helpers for persona workflows

## Runtime Model

- `src/main.ts` starts a Nest microservice using `Transport.TCP`
- `src/app/app.module.ts` wires config, logger, database connection, controllers, services, and repositories
- repositories are bound for `PersonaTelos`, `ProfileTelos`, and `ProjectTelos`
- the domain logic is split into `persona-telos`, `profile-telos`, and `project-telos`

## Domain Layout

The service is intentionally partitioned by Telos subject area:

- `persona-telos/`
- `profile-telos/`
- `project-telos/`

That split is the primary design boundary and should remain the organizing principle for future docs and code changes.

## Operationally Important Files

- `src/app/config.ts`
- `src/app/database.ts`
- `src/app/staticDatabase.ts`
- `src/app/seed-persona.ts`
- `src/app/seed-persona.helpers.ts`
- `src/app/benchmark-personas-and-models.ts`
