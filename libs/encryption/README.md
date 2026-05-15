# @optimistic-tanuki/encryption

Shared encryption helpers and Nest-compatible module exports used by Optimistic Tanuki backend services.

## Install

```bash
npm install @optimistic-tanuki/encryption @nestjs/common
```

## Usage

```ts
import { AsymmetricService, EncryptionModule, SaltedHashService } from '@optimistic-tanuki/encryption';

export { AsymmetricService, EncryptionModule, SaltedHashService };
```

## Runtime

This package targets Node.js and NestJS service runtimes. `@nestjs/common` is provided as a peer dependency.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
