# Assets Architecture

`assets` is a Nest TCP microservice responsible for validating, scanning, persisting, retrieving, listing, and deleting asset records and their underlying file content.

## Main Responsibilities

- accept asset creation requests with inline content or source-file paths
- validate file metadata and content characteristics before persistence
- perform virus scanning before accepting uploads
- persist metadata in the assets database
- delegate binary storage to the configured storage adapter
- return metadata or file content for later retrieval

## Runtime Model

- `src/main.ts` starts a Nest microservice using `Transport.TCP`
- `src/app/app.module.ts` wires config, database, logger, storage, validation, and scanning
- `src/app/app.service.ts` contains the asset lifecycle workflows
- `src/entities/asset.entity` stores metadata for persisted assets

## Storage Model

The service supports two runtime storage strategies:

- local filesystem storage
- network-backed S3-compatible storage

Storage is selected through config at module startup and exposed to the service through the `StorageAdapter` abstraction from `@optimistic-tanuki/storage`.

## Processing Pipeline

For asset creation:

1. normalize filename and content
2. resolve content from inline payload or source path
3. validate file type and size
4. scan for threats
5. create a DB entity shell
6. persist binary content through the storage adapter
7. save merged metadata to the repository

That split makes the storage layer replaceable without changing the caller contract.
