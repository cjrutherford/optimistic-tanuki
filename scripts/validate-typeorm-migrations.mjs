#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationDirectories = [
  'apps/app-configurator/migrations',
  'apps/assets/migrations',
  'apps/authentication/migrations',
  'apps/blogging/migrations',
  'apps/chat-collector/migrations',
  'apps/classifieds/migrations',
  'apps/finance/src/migrations',
  'apps/forum/migrations',
  'apps/lead-tracker/migrations',
  'apps/payments/migrations',
  'apps/permissions/migrations',
  'apps/profile/migrations',
  'apps/project-planning/migrations',
  'apps/social/migrations',
  'apps/store/migrations',
  'apps/system-configurator-api/src/migrations',
  'apps/telos-docs-service/migrations',
  'apps/videos/migrations',
  'apps/wellness/migrations',
];

const errors = [];
for (const migrationDirectory of migrationDirectories) {
  const absoluteDirectory = join(workspaceRoot, migrationDirectory);
  const timestamps = new Map();
  let previousTimestamp = '';
  for (const file of readdirSync(absoluteDirectory)
    .filter((item) => item.endsWith('.ts'))
    .sort()) {
    const filePath = join(absoluteDirectory, file);
    const source = readFileSync(filePath, 'utf8');
    const className = source.match(
      /export class\s+(\w+)\s+(?:implements\s+MigrationInterface|\n\s+implements\s+MigrationInterface)/
    )?.[1];
    if (!className) continue;

    const timestamp = className.match(/(\d{13})$/)?.[1];
    if (!timestamp || /\d{14,}$/.test(className)) {
      errors.push(
        `${relative(
          workspaceRoot,
          filePath
        )}: ${className} must end with exactly one 13-digit CLI timestamp`
      );
      continue;
    }
    const filenameTimestamp = file.match(/^(\d{13})-/)?.[1];
    if (filenameTimestamp !== timestamp) {
      errors.push(
        `${relative(
          workspaceRoot,
          filePath
        )}: filename timestamp must match ${className}`
      );
      continue;
    }
    if (timestamps.has(timestamp)) {
      errors.push(
        `${relative(
          workspaceRoot,
          filePath
        )}: timestamp ${timestamp} duplicates ${timestamps.get(timestamp)}`
      );
      continue;
    }
    if (previousTimestamp && timestamp < previousTimestamp) {
      errors.push(
        `${relative(
          workspaceRoot,
          filePath
        )}: timestamp ${timestamp} must follow ${previousTimestamp} in runtime order`
      );
      continue;
    }
    timestamps.set(timestamp, file);
    previousTimestamp = timestamp;
  }
}

if (errors.length) {
  console.error('TypeORM migration validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('TypeORM migration validation passed.');
}
