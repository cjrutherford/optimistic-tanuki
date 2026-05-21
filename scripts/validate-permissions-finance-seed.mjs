#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const seedData = JSON.parse(
  readFileSync('apps/permissions/src/assets/default-permissions.json', 'utf8'),
);
const shellSeed = readFileSync('seed-permissions.sh', 'utf8');
const financeController = readFileSync(
  'apps/gateway/src/controllers/finance/finance.controller.ts',
  'utf8',
);
const finCommanderProfile = readFileSync(
  'apps/fin-commander/src/app/profile.service.ts',
  'utf8',
);

const financePermissions = [
  'finance.account.create',
  'finance.account.read',
  'finance.account.update',
  'finance.account.delete',
  'finance.transaction.create',
  'finance.transaction.read',
  'finance.transaction.update',
  'finance.transaction.delete',
  'finance.inventory.create',
  'finance.inventory.read',
  'finance.inventory.update',
  'finance.inventory.delete',
  'finance.budget.create',
  'finance.budget.read',
  'finance.budget.update',
  'finance.budget.delete',
  'finance.recurring.create',
  'finance.recurring.read',
  'finance.recurring.update',
  'finance.recurring.delete',
  'finance.summary.read',
  'finance.bank.manage',
  'finance.onboarding.manage',
  'finance.tenant.manage',
  'finance.member.manage',
];

const expectedRoles = [
  'finance_member',
  'finance_bookkeeper',
  'finance_manager',
  'finance_admin',
];

const guardedFinancePermissions = [
  ...new Set(
    [...financeController.matchAll(/RequirePermissions\('([^']+)'\)/g)].map(
      ([, permission]) => permission,
    ),
  ),
].sort();

assert.equal(
  seedData.app_scopes.some((scope) => scope.name === 'finance'),
  true,
  'default permissions seed must include the finance app scope',
);

assert.deepEqual(
  financePermissions.toSorted(),
  guardedFinancePermissions,
  'finance seed permission catalog must match the permissions required by the finance gateway controller',
);

assert.match(
  finCommanderProfile,
  /readonly\s+appScope\s*=\s*'finance'/,
  'fin-commander must continue to use the finance app scope',
);

for (const role of expectedRoles) {
  assert.equal(
    seedData.roles.some(
      (entry) => entry.name === role && entry.appScope === 'finance',
    ),
    true,
    `default permissions seed must include ${role}`,
  );
}

for (const permission of financePermissions) {
  assert.equal(
    seedData.permissions.some(
      (entry) => entry.name === permission && entry.appScope === 'finance',
    ),
    true,
    `default permissions seed must include ${permission}`,
  );
}

for (const role of expectedRoles) {
  assert.equal(
    seedData.role_permissions.some(
      (entry) =>
        entry.role === role &&
        entry.permissionAppScope === 'finance' &&
        financePermissions.includes(entry.permission),
    ),
    true,
    `default permissions seed must map permissions for ${role}`,
  );
}

for (const managerPermission of [
  'finance.bank.manage',
  'finance.onboarding.manage',
  'finance.summary.read',
]) {
  assert.equal(
    seedData.role_permissions.some(
      (entry) =>
        entry.role === 'finance_manager' &&
        entry.permission === managerPermission &&
        entry.permissionAppScope === 'finance',
    ),
    true,
    `default permissions seed must map ${managerPermission} to finance_manager`,
  );
}

for (const soloUserPermission of [
  'finance.account.create',
  'finance.account.read',
  'finance.account.update',
  'finance.account.delete',
  'finance.transaction.create',
  'finance.transaction.read',
  'finance.transaction.update',
  'finance.transaction.delete',
  'finance.inventory.create',
  'finance.inventory.read',
  'finance.inventory.update',
  'finance.inventory.delete',
  'finance.budget.create',
  'finance.budget.read',
  'finance.budget.update',
  'finance.budget.delete',
  'finance.recurring.create',
  'finance.recurring.read',
  'finance.recurring.update',
  'finance.recurring.delete',
  'finance.bank.manage',
  'finance.tenant.manage',
  'finance.onboarding.manage',
  'finance.summary.read',
]) {
  assert.equal(
    seedData.role_permissions.some(
      (entry) =>
        entry.role === 'finance_member' &&
        entry.permission === soloUserPermission &&
        entry.permissionAppScope === 'finance',
    ),
    true,
    `default permissions seed must map ${soloUserPermission} to finance_member`,
  );
}

for (const token of [
  "('finance', 'Finance application', true)",
  "'finance_member'",
  "'finance_bookkeeper'",
  "'finance_manager'",
  "'finance_admin'",
  "'finance.account.create'",
  "'finance.bank.manage'",
  "'finance.member.manage'",
]) {
  assert.equal(shellSeed.includes(token), true, `seed-permissions.sh must include ${token}`);
}
