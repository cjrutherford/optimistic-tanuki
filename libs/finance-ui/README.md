# Finance UI Library

Angular component library for financial management features.

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
