# @optimistic-tanuki/constants

Shared command names, service tokens, and enum-style constants used across Optimistic Tanuki applications and services.

## Install

```bash
npm install @optimistic-tanuki/constants @angular/core @nestjs/common
```

## Usage

```ts
import { BillingCommands, ServiceTokens } from '@optimistic-tanuki/constants';

console.log(BillingCommands);
console.log(ServiceTokens);
```

## Runtime

This package supports Angular clients, Node.js services, and shared TypeScript consumers. It exposes Angular injection tokens and a Nest-compatible module export, so `@angular/core` and `@nestjs/common` are peer dependencies.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
