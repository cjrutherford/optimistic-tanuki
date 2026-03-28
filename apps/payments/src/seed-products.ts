import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { LemonSqueezyProduct } from './entities/lemon-squeezy-product.entity';
import { readPaymentsConfig } from './config';

interface SeedProduct {
  appScope: string;
  tier: string;
  name: string;
  lemonSqueezyProductId: string;
  lemonSqueezyVariantId: string;
  isActive: boolean;
}

const DEFAULT_PRODUCTS: SeedProduct[] = [
  // local-hub: Business page tiers
  {
    appScope: 'local-hub',
    tier: 'basic',
    name: 'Basic Business Page',
    lemonSqueezyProductId: 'PLACEHOLDER_BASIC_PRODUCT_ID',
    lemonSqueezyVariantId: 'PLACEHOLDER_BASIC_VARIANT_ID',
    isActive: true,
  },
  {
    appScope: 'local-hub',
    tier: 'pro',
    name: 'Pro Business Page',
    lemonSqueezyProductId: 'PLACEHOLDER_PRO_PRODUCT_ID',
    lemonSqueezyVariantId: 'PLACEHOLDER_PRO_VARIANT_ID',
    isActive: true,
  },
  {
    appScope: 'local-hub',
    tier: 'enterprise',
    name: 'Enterprise Business Page',
    lemonSqueezyProductId: 'PLACEHOLDER_ENTERPRISE_PRODUCT_ID',
    lemonSqueezyVariantId: 'PLACEHOLDER_ENTERPRISE_VARIANT_ID',
    isActive: true,
  },
  // local-hub: Donations
  {
    appScope: 'local-hub',
    tier: 'donation-one-time',
    name: 'One-Time Donation',
    lemonSqueezyProductId: 'PLACEHOLDER_DONATION_ONE_TIME_PRODUCT_ID',
    lemonSqueezyVariantId: 'PLACEHOLDER_DONATION_ONE_TIME_VARIANT_ID',
    isActive: true,
  },
  {
    appScope: 'local-hub',
    tier: 'donation-recurring',
    name: 'Recurring Donation',
    lemonSqueezyProductId: 'PLACEHOLDER_DONATION_RECURRING_PRODUCT_ID',
    lemonSqueezyVariantId: 'PLACEHOLDER_DONATION_RECURRING_VARIANT_ID',
    isActive: true,
  },
  // local-hub: Classified payments (fee-based)
  {
    appScope: 'local-hub',
    tier: 'classified-fee',
    name: 'Classified Listing Fee',
    lemonSqueezyProductId: 'PLACEHOLDER_CLASSIFIED_FEE_PRODUCT_ID',
    lemonSqueezyVariantId: 'PLACEHOLDER_CLASSIFIED_FEE_VARIANT_ID',
    isActive: true,
  },
];

function parseArgs(): { appScope?: string; list: boolean; sync: boolean } {
  const args = process.argv.slice(2);
  const result = {
    appScope: undefined as string | undefined,
    list: false,
    sync: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--app' && args[i + 1]) {
      result.appScope = args[i + 1];
      i++;
    } else if (arg === '--list') {
      result.list = true;
    } else if (arg === '--sync') {
      result.sync = true;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Seed Lemon Squeezy Products

Usage: npm run seed:products [options]

Options:
  --app <scope>    Seed products for specific app scope (e.g., owner-console, local-hub)
  --list           List available products in database
  --sync           Sync products from Lemon Squeezy API (requires API key in config)
  --help           Show this help message

Examples:
  npm run seed:products -- --app owner-console
  npm run seed:products -- --list
  npm run seed:products
  `);
}

async function getDataSource(): Promise<DataSource> {
  const { config, configPath } = readPaymentsConfig();
  const { database } = config;
  const host = process.env.POSTGRES_HOST || database.host;
  const dbName = process.env.POSTGRES_DB || database.database;
  console.log(`Using config from: ${configPath}`);
  console.log(
    `Connecting to database at ${host}:${database.port} to ${dbName}...`
  );

  const ds = new DataSource({
    type: 'postgres',
    host,
    port: Number(database.port),
    username: database.username,
    password: database.password,
    database: dbName,
    entities: [LemonSqueezyProduct],
  });

  await ds.initialize();
  return ds;
}

async function seedProducts(appScope?: string) {
  const dataSource = await getDataSource();
  const productRepo = dataSource.getRepository(LemonSqueezyProduct);

  const productsToSeed = appScope
    ? DEFAULT_PRODUCTS.filter((p) => p.appScope === appScope)
    : DEFAULT_PRODUCTS;

  if (productsToSeed.length === 0) {
    console.log(`No products configured for app scope: ${appScope}`);
    console.log('Available app scopes:', [
      ...new Set(DEFAULT_PRODUCTS.map((p) => p.appScope)),
    ]);
    await dataSource.destroy();
    process.exit(1);
  }

  console.log(`Seeding products for: ${appScope || 'all apps'}...`);

  for (const product of productsToSeed) {
    const existing = await productRepo.findOne({
      where: { appScope: product.appScope, tier: product.tier as any },
    });

    if (existing) {
      console.log(`  Updating ${product.tier} for ${product.appScope}...`);
      Object.assign(existing, product);
      await productRepo.save(existing);
    } else {
      console.log(`  Creating ${product.tier} for ${product.appScope}...`);
      const newProduct = productRepo.create(product as any);
      await productRepo.save(newProduct);
    }
  }

  console.log('Seed complete!');
  await dataSource.destroy();
}

async function listProducts() {
  const dataSource = await getDataSource();
  const productRepo = dataSource.getRepository(LemonSqueezyProduct);

  const products = await productRepo.find({
    order: { appScope: 'ASC', tier: 'ASC' },
  });

  console.log('\nLemon Squeezy Products in Database:\n');
  console.log('| App Scope | Tier | Product ID | Variant ID | Active |');
  console.log('|-----------|------|------------|------------|--------|');

  for (const p of products) {
    console.log(
      `| ${p.appScope.padEnd(10)} | ${p.tier.padEnd(5)} | ${(
        p.lemonSqueezyProductId || 'N/A'
      )
        .slice(0, 12)
        .padEnd(12)} | ${(p.lemonSqueezyVariantId || 'N/A')
          .slice(0, 12)
          .padEnd(12)} | ${p.isActive ? 'Yes' : 'No'} |`
    );
  }

  console.log('');
  await dataSource.destroy();
}

async function main() {
  const { appScope, list, sync } = parseArgs();

  if (list) {
    await listProducts();
    return;
  }

  if (sync) {
    console.log(
      'Sync from Lemon Squeezy API is not implemented in seed script.'
    );
    console.log(
      'Use the PaymentService.syncLemonSqueezyProducts() method via the payments microservice.'
    );
    process.exit(1);
  }

  await seedProducts(appScope);
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
