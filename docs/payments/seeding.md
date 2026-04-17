# Lemon Squeezy Product Seeding

This guide covers how to set up and seed Lemon Squeezy products for the payments microservice.

## Overview

The payments app uses Lemon Squeezy for payment processing. Products are stored in the `lemon_squeezy_products` table and matched by:

- **appScope**: The application scope (e.g., `owner-console`, `local-hub`)
- **tier**: The product tier (e.g., `basic`, `pro`, `enterprise`)

## App Scopes

| App Scope       | Products                 | Description                 |
| --------------- | ------------------------ | --------------------------- |
| `owner-console` | basic, pro, enterprise   | Business page subscriptions |
| `local-hub`     | (handled at store level) | Donations and sponsorships  |

## Configuration

### 1. Configure Lemon Squeezy Store

Edit `apps/payments/src/assets/config.yaml`:

```yaml
lemonSqueezy:
  default:
    apiKey: 'your-lemon-squeezy-api-key'
    storeId: 'your-store-id'
  stores:
    owner-console:
      apiKey: 'owner-console-api-key'
      storeId: 'owner-console-store-id'
    local-hub:
      apiKey: 'local-hub-api-key'
      storeId: 'local-hub-store-id'
```

### 2. Seed Products from Lemon Squeezy API (Recommended)

The recommended approach is to sync products directly from the Lemon Squeezy API. This automatically fetches your actual products and variants.

**Via Microservice Command:**

```typescript
// From another service
const client = require('@nestjs/microservices');
client.send('payments.syncLemonSqueezyProducts', { appScope: 'owner-console' });
```

### 3. Seed Products Manually

For development or when API access isn't available, you can seed placeholder products using the setup script:

**Via setup-and-migrate.sh (runs automatically after migrations):**

```bash
npm run db:setup
```

**Direct execution:**

```bash
cd apps/payments
node -r ts-node/register -r tsconfig-paths/register ./src/seed-products.ts
```

### 4. List Existing Products

```bash
cd apps/payments
node -r ts-node/register -r tsconfig-paths/register ./src/seed-products.ts --list
```

## Seed Script Options

| Option          | Description                                               |
| --------------- | --------------------------------------------------------- |
| `--app <scope>` | Seed products for specific app (owner-console, local-hub) |
| `--list`        | List all products in database                             |
| `--sync`        | Sync products from Lemon Squeezy API (via microservice)   |
| `--help`        | Show help message                                         |

## Example: Setting Up Local Development

### Step 1: Configure Store

Add your Lemon Squeezy API key to `apps/payments/src/assets/config.yaml`:

```yaml
lemonSqueezy:
  default:
    apiKey: 'ls_xxxxx' # Your API key from Lemon Squeezy
    storeId: '12345' # Your store ID
  stores:
    owner-console:
      apiKey: 'ls_xxxxx'
      storeId: '12345'
```

### Step 2: Run Database Migrations

```bash
npm run payments:typeorm:migration:run
```

This creates the `lemon_squeezy_products` table.

### Step 3: Seed Products

**Option A: Sync from API (recommended)**

Call the sync command via the payments microservice (see section 2 above).

**Option B: Manual seed via setup-and-migrate.sh**

```bash
npm run db:setup
```

### Step 4: Verify Products

```bash
cd apps/payments
node -r ts-node/register -r tsconfig-paths/register ./src/seed-products.ts --list
```

## Product Structure

The `lemon_squeezy_products` table contains:

| Field                   | Type      | Description                                       |
| ----------------------- | --------- | ------------------------------------------------- |
| `id`                    | UUID      | Primary key                                       |
| `appScope`              | varchar   | Application identifier (owner-console, local-hub) |
| `tier`                  | varchar   | Product tier (basic, pro, enterprise)             |
| `lemonSqueezyProductId` | varchar   | Product ID from Lemon Squeezy                     |
| `lemonSqueezyVariantId` | varchar   | Variant ID for checkout URLs                      |
| `name`                  | varchar   | Display name                                      |
| `isActive`              | boolean   | Whether product is available                      |
| `createdAt`             | timestamp | Creation timestamp                                |
| `updatedAt`             | timestamp | Last update timestamp                             |

## Troubleshooting

### Products Not Found

If checkout fails with "No Lemon Squeezy variant found":

1. Verify products are seeded (run seed-products.ts --list)
2. Check appScope matches between checkout call and seeded product
3. Ensure `isActive` is `true` for the product

### API Sync Fails

- Verify API key has correct permissions
- Check store ID matches your Lemon Squeezy store
- Ensure network connectivity to `api.lemonsqueezy.com`

### Migration Fails

- Ensure PostgreSQL is running
- Check database credentials in config.yaml
- Verify migrations path is correct

## Files Reference

- **Entity**: `apps/payments/src/entities/lemon-squeezy-product.entity.ts`
- **Seed Script**: `apps/payments/src/seed-products.ts`
- **Config**: `apps/payments/src/assets/config.yaml`
- **Payment Service**: `apps/payments/src/app/services/payment.service.ts` (contains `syncLemonSqueezyProducts` method)
- **Setup Script**: `setup-and-migrate.sh` (runs seed after migrations)
