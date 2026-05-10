# Finance UI Library

`finance-ui` contains reusable Angular UI for financial management features. Its source lives under `libs/finance-ui/src/lib`.

## Repo Role

- shared finance-oriented frontend UI for dashboards, forms, and lists
- intended for frontend applications that expose finance workflows

## Nx Commands

```bash
pnpm exec nx build finance-ui
pnpm exec nx test finance-ui
```

## Features

- Account management
- Transaction tracking
- Inventory management
- Budget planning
- Financial dashboard

## Usage

Import the routes in your application:

```typescript
import { financeRoutes } from '@optimistic-tanuki/finance-ui';

const routes: Routes = [
  {
    path: 'finance',
    children: financeRoutes
  }
];
```

## Components

- `DashboardComponent` - Main financial dashboard
- `AccountListComponent` - List of accounts
- `TransactionListComponent` - List of transactions
- `AccountFormComponent` - Account create/edit form
- `TransactionFormComponent` - Transaction create/edit form
