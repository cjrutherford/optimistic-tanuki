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

/**
 * Services that number migrations by date (`YYYYMMDD#####`) instead of by
 * `Date.now()` epoch milliseconds.
 *
 * The two styles are not interchangeable. A dated number (~2.0e12) is
 * numerically larger than a present-day epoch one (~1.79e12), so a migration
 * straight out of `typeorm migration:generate` sorts *before* every dated
 * migration no matter when it was written — and TypeORM runs migrations in
 * timestamp order. On a fresh database the generated migration then executes
 * ahead of the ones it depends on.
 *
 * This fails nowhere on an existing database, because the old migrations are
 * already applied there. Only CI and a new developer build the schema from
 * nothing, which is exactly what this check protects.
 *
 * `legacyEpochCeiling` is the last migration predating the dated convention;
 * `datedFloor` is the first dated one. Anything landing between the two is a
 * generated timestamp that has not been renamed.
 */
const datedConventionDirectories = {
  'apps/lead-tracker/migrations': {
    legacyEpochCeiling: '1774825000000',
    datedFloor: '2026033000000',
  },
};

const errors = [];
for (const migrationDirectory of migrationDirectories) {
  const datedConvention = datedConventionDirectories[migrationDirectory];
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
    if (
      datedConvention &&
      timestamp > datedConvention.legacyEpochCeiling &&
      timestamp < datedConvention.datedFloor
    ) {
      errors.push(
        `${relative(
          workspaceRoot,
          filePath
        )}: timestamp ${timestamp} is a generated epoch-ms value, which sorts ` +
          `before the dated migrations in this directory and makes a fresh ` +
          `database unbuildable. Rename the file and the class-name suffix to ` +
          `the YYYYMMDD##### convention, using a number greater than every ` +
          `existing migration here.`
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
