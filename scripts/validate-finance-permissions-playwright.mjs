#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import pg from 'pg';

const { Client } = pg;

const appUrl = process.env.FIN_COMMANDER_URL ?? 'http://127.0.0.1:8089';
const gatewayUrl = process.env.GATEWAY_URL ?? 'http://127.0.0.1:3000';
const database = {
  host: process.env.POSTGRES_HOST ?? '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  database: process.env.POSTGRES_DB ?? 'ot_permissions',
};

const financeController = readFileSync(
  'apps/gateway/src/controllers/finance/finance.controller.ts',
  'utf8',
);
const finCommanderProfile = readFileSync(
  'apps/fin-commander/src/app/profile.service.ts',
  'utf8',
);

const expectedFinancePermissions = [
  ...new Set(
    [...financeController.matchAll(/RequirePermissions\('([^']+)'\)/g)].map(
      ([, permission]) => permission,
    ),
  ),
].sort();

const expectedRoles = [
  'finance_admin',
  'finance_bookkeeper',
  'finance_manager',
  'finance_member',
];

const expectedManagerPermissions = [
  'finance.bank.manage',
  'finance.onboarding.manage',
  'finance.summary.read',
];

async function validateBrowser() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const appResponse = await page.goto(appUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    assert(appResponse?.ok(), `fin-commander did not load: ${appResponse?.status()}`);
    await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 });

    const gatewayResponse = await page.goto(`${gatewayUrl}/api-docs`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    assert(
      gatewayResponse?.ok(),
      `gateway API docs did not load: ${gatewayResponse?.status()}`,
    );
  } finally {
    await browser.close();
  }
}

async function validatePermissionsDatabase() {
  assert.match(
    finCommanderProfile,
    /readonly\s+appScope\s*=\s*'finance'/,
    'fin-commander must use the finance app scope',
  );

  const client = new Client(database);
  await client.connect();
  try {
    const scope = await client.query(
      'select id, name from app_scope where name = $1 and active = true',
      ['finance'],
    );
    assert.equal(scope.rowCount, 1, 'active finance app scope must be seeded');

    const roles = await client.query(
      `
        select r.name
        from role r
        join app_scope s on s.id = r."appScopeId"
        where s.name = $1 and r.name = any($2)
        order by r.name
      `,
      ['finance', expectedRoles],
    );
    assert.deepEqual(
      roles.rows.map((row) => row.name),
      expectedRoles,
      'finance roles must be seeded under the finance app scope',
    );

    const permissions = await client.query(
      `
        select p.name
        from permission p
        join app_scope s on s.id = p."appScopeId"
        where s.name = $1 and p.name = any($2)
        order by p.name
      `,
      ['finance', expectedFinancePermissions],
    );
    assert.deepEqual(
      permissions.rows.map((row) => row.name),
      expectedFinancePermissions,
      'seeded finance permissions must match finance gateway guards',
    );

    const adminMappings = await client.query(
      `
        select p.name
        from role_permissions rp
        join role r on r.id = rp.role_id
        join permission p on p.id = rp.permission_id
        join app_scope s on s.id = p."appScopeId"
        where s.name = $1 and r.name = $2 and p.name = any($3)
        order by p.name
      `,
      ['finance', 'finance_admin', expectedFinancePermissions],
    );
    assert.deepEqual(
      adminMappings.rows.map((row) => row.name),
      expectedFinancePermissions,
      'finance_admin must map to every finance gateway permission',
    );

    const managerMappings = await client.query(
      `
        select p.name
        from role_permissions rp
        join role r on r.id = rp.role_id
        join permission p on p.id = rp.permission_id
        join app_scope s on s.id = p."appScopeId"
        where s.name = $1 and r.name = $2 and p.name = any($3)
        order by p.name
      `,
      ['finance', 'finance_manager', expectedManagerPermissions],
    );
    assert.deepEqual(
      managerMappings.rows.map((row) => row.name),
      expectedManagerPermissions.toSorted(),
      'finance_manager must map setup, bank, and summary permissions',
    );
  } finally {
    await client.end();
  }
}

await validateBrowser();
await validatePermissionsDatabase();

console.log(
  `Validated ${expectedFinancePermissions.length} finance permissions, ${expectedRoles.length} finance roles, fin-commander app scope, and browser access.`,
);
