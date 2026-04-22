import fs from 'fs';

const catalogPath = 'docs/architecture/app-catalog.manifest.json';
const requiredEntries = [
  '@optimistic-tanuki/billing-contracts',
  '@optimistic-tanuki/billing-sdk',
  '@optimistic-tanuki/app-catalog-contracts',
  'apps/billing',
  'apps/payments',
];
const releaseChannels = new Set(['alpha', 'beta', 'stable']);
const deploymentModes = new Set([
  'deployable-app',
  'internal-lib',
  'publishable-lib',
  'app-service',
]);
const billingEligibility = new Set(['seat', 'metered', 'usage-block', 'none']);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!fs.existsSync(catalogPath)) {
  fail(`Missing developer catalog manifest: ${catalogPath}`);
  process.exit();
}

const manifest = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

if (!Array.isArray(manifest.entries)) {
  fail(`${catalogPath} must contain an entries array`);
  process.exit();
}

const names = new Set();

for (const entry of manifest.entries) {
  if (!entry.name || typeof entry.name !== 'string') {
    fail('Catalog entries require a string name');
    continue;
  }

  if (names.has(entry.name)) {
    fail(`Duplicate developer catalog entry: ${entry.name}`);
  }
  names.add(entry.name);

  if (!entry.ownerDomain || typeof entry.ownerDomain !== 'string') {
    fail(`${entry.name} requires ownerDomain`);
  }

  if (!releaseChannels.has(entry.releaseChannel)) {
    fail(`${entry.name} has invalid releaseChannel: ${entry.releaseChannel}`);
  }

  if (!deploymentModes.has(entry.deploymentMode)) {
    fail(`${entry.name} has invalid deploymentMode: ${entry.deploymentMode}`);
  }

  if (!Array.isArray(entry.billingEligibility)) {
    fail(`${entry.name} requires billingEligibility array`);
    continue;
  }

  for (const eligibility of entry.billingEligibility) {
    if (!billingEligibility.has(eligibility)) {
      fail(`${entry.name} has invalid billing eligibility: ${eligibility}`);
    }
  }

  if (
    entry.deploymentMode === 'app-service' &&
    !entry.billingEligibility.some((eligibility) => eligibility !== 'none')
  ) {
    fail(`${entry.name} app-service entries must declare billable eligibility`);
  }
}

for (const requiredEntry of requiredEntries) {
  if (!names.has(requiredEntry)) {
    fail(`${catalogPath} is missing required entry: ${requiredEntry}`);
  }
}

if (process.exitCode) {
  process.exit();
}

console.log('Developer app catalog is valid.');
