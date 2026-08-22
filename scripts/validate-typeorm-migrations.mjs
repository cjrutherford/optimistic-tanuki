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
 * Migration timestamps must be real `Date.now()` epoch milliseconds, which is
 * what `typeorm migration:generate` produces. Numbers shaped like a date
 * (`20260603_____`) are numerically far larger than a present-day epoch value,
 * so they sort after everything the CLI will generate for years — which quietly
 * inverts run order and can make the schema unbuildable from scratch.
 *
 * `lead-tracker` had seven such migrations. They are now real epoch values for
 * the dates they were written on, so every directory here uses one convention
 * and CLI output can be committed as-is.
 */
/**
 * A hand-written date is recognised by its shape, not its magnitude: as an
 * epoch value `2026090100000` is only the year 2034, so a plain upper bound
 * does not catch it. What gives it away is that its leading eight digits read
 * as a calendar date. Real epoch timestamps do not — `1787227913318` starts
 * `17872279`, a month 22 that no date has.
 */
const looksLikeHandWrittenDate = (timestamp) => {
  const [, year, month, day] =
    /^(\d{4})(\d{2})(\d{2})\d{5}$/.exec(timestamp) || [];
  if (!year) {
    return false;
  }
  return (
    Number(year) >= 2000 &&
    Number(year) <= 2099 &&
    Number(month) >= 1 &&
    Number(month) <= 12 &&
    Number(day) >= 1 &&
    Number(day) <= 31
  );
};

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
    if (looksLikeHandWrittenDate(timestamp)) {
      errors.push(
        `${relative(
          workspaceRoot,
          filePath
        )}: timestamp ${timestamp} is not a plausible epoch-ms value — it looks ` +
          `like a hand-written date. Use the timestamp ` +
          `\`typeorm migration:generate\` assigns, so run order matches the ` +
          `order migrations were written in.`
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
