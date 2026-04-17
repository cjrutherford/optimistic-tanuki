# Finance Microservice

Financial management microservice for the Optimistic Tanuki platform.

## Features

- **Account Management**: Track multiple accounts (bank, credit, cash, investment)
- **Transaction Tracking**: Record credits and debits with categorization
- **Inventory Management**: Track valuable items with quantity and valuation
- **Budget Planning**: Create and monitor budgets by category and time period

## Entities

### Account
- Supports multiple account types: bank, credit, cash, investment, other
- Tracks balance in different currencies
- Maintains active/inactive status
- Links to user and profile

### Transaction
- Records debits and credits
- Categorizes transactions (groceries, rent, salary, etc.)
- Supports recurring transactions
- Automatically updates account balances
- Optional reference numbers

### InventoryItem
- Tracks items with quantity and unit value
- Automatic total value calculation
- SKU and location tracking
- Categories for organization

### Budget
- Set spending limits by category
- Track actual spending vs budget
- Multiple time periods: daily, weekly, monthly, yearly
- Optional alerts when budget is exceeded

## API Endpoints

All endpoints are available through the gateway at `/api/finance/*`

### Accounts
- `POST /api/finance/account` - Create account
- `GET /api/finance/account/:id` - Get account by ID
- `GET /api/finance/accounts` - List all accounts
- `PUT /api/finance/account/:id` - Update account
- `DELETE /api/finance/account/:id` - Delete account

### Transactions
- `POST /api/finance/transaction` - Create transaction
- `GET /api/finance/transaction/:id` - Get transaction by ID
- `GET /api/finance/transactions` - List all transactions
- `GET /api/finance/account/:accountId/transactions` - Get transactions for account
- `PUT /api/finance/transaction/:id` - Update transaction
- `DELETE /api/finance/transaction/:id` - Delete transaction

### Inventory Items
- `POST /api/finance/inventory-item` - Create item
- `GET /api/finance/inventory-item/:id` - Get item by ID
- `GET /api/finance/inventory-items` - List all items
- `PUT /api/finance/inventory-item/:id` - Update item
- `DELETE /api/finance/inventory-item/:id` - Delete item

### Budgets
- `POST /api/finance/budget` - Create budget
- `GET /api/finance/budget/:id` - Get budget by ID
- `GET /api/finance/budgets` - List all budgets
- `PUT /api/finance/budget/:id` - Update budget
- `DELETE /api/finance/budget/:id` - Delete budget

## Database

Uses PostgreSQL database `ot_finance` with TypeORM migrations.

### Running Migrations

Migrations run automatically as part of `npm run db:setup`.

To run manually:
```bash
cd apps/finance
export POSTGRES_DB=ot_finance
export POSTGRES_HOST=localhost
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
npx typeorm -d src/app/staticDatabase.ts migration:run
```

## Seeding Data

The service includes a seed script with realistic sample data. See [SEED_DATA.md](./SEED_DATA.md) for details.

Run seeding:
```bash
docker compose exec finance node /usr/src/app/seed-finance.js
```

## Development

### Build
```bash
nx build finance
```

### Run locally
```bash
nx serve finance
```

### Run in Docker
```bash
docker compose up finance
```

## Security

- All user input is sanitized with DOMPurify
- XSS prevention on all text fields
- Authentication required for create/update/delete operations
- Permission-based authorization via gateway
- Rate limiting to prevent abuse

## Environment Variables

- `POSTGRES_HOST` - Database host (default: db)
- `POSTGRES_PORT` - Database port (default: 5432)
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name (default: ot_finance)
- `PORT` - Service port (default: 3016)
