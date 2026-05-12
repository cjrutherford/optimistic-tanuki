# @optimistic-tanuki/logger

Shared Nest-compatible logging module exports for Optimistic Tanuki backend services.

## Install

```bash
npm install @optimistic-tanuki/logger @nestjs/common
```

## Usage

```ts
import { Logger } from '@nestjs/common';
import { LoggerModule } from '@optimistic-tanuki/logger';

export { Logger, LoggerModule };
```

## Runtime

This package targets Node.js and NestJS service runtimes. `@nestjs/common` is provided as a peer dependency.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
