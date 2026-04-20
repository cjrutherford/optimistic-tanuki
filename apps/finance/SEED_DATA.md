# Finance Seed Data Documentation

This document describes the sample data created by the `seed-finance.ts` script.

## Accounts (6 total)

1. **Primary Checking Account** (Bank)
   - Balance: $5,432.18
   - Main checking account for daily expenses

2. **High-Yield Savings** (Bank)
   - Balance: $15,000.00
   - Emergency fund and savings

3. **Credit Card - Rewards** (Credit)
   - Balance: -$1,250.45 (negative = owed)
   - Cashback rewards credit card

4. **Investment Account** (Investment)
   - Balance: $28,500.75
   - Long-term investment portfolio

5. **Cash Wallet** (Cash)
   - Balance: $250.00
   - Physical cash on hand

6. **Business Checking** (Bank)
   - Balance: $8,750.50
   - Small business operating account

**Total Net Worth: $56,682.98**

## Transactions (16 total)

### Checking Account Transactions
- Monthly salary deposit: +$3,500.00
- Monthly rent payment: -$1,200.00
- Weekly groceries: -$85.42
- Electric bill: -$45.00
- Internet service: -$55.00
- Car insurance: -$150.00
- Lunch at restaurant: -$32.50
- Gas station: -$75.00

### Credit Card Transactions
- Amazon electronics: -$120.00
- Movie tickets: -$65.00
- Netflix subscription: -$15.99

### Savings Account Transactions
- Monthly savings transfer: +$500.00
- Interest payment: +$2.15

### Business Account Transactions
- Client payment: +$2,500.00
- Software licenses: -$450.00
- Marketing: -$200.00

## Inventory Items (10 total)

1. **MacBook Pro M3 16"** - $3,499.00 (Electronics)
2. **Standing Desk** - $650.00 (Furniture)
3. **Herman Miller Aeron Chair** - $1,200.00 (Furniture)
4. **Sony WH-1000XM5 Headphones** - $399.99 (Electronics)
5. **LG 27" 4K Monitor** (x2) - $900.00 total (Electronics)
6. **iPhone 15 Pro** - $999.00 (Electronics)
7. **Vintage Guitar Collection** (x3) - $4,500.00 total (Collectibles)
8. **Camera Equipment** - $2,200.00 (Electronics)
9. **Smart Home Hub** - $150.00 (Electronics)
10. **Library Books Collection** (x150) - $2,250.00 total (Books)

**Total Inventory Value: $16,747.99**

## Budgets (7 total)

### Monthly Budgets
1. **Groceries**: $600.00 limit, $85.42 spent (14%)
2. **Dining Out**: $300.00 limit, $32.50 spent (11%)
3. **Entertainment**: $200.00 limit, $65.00 spent (33%)
4. **Transportation**: $400.00 limit, $75.00 spent (19%)
5. **Shopping**: $500.00 limit, $120.00 spent (24%)
6. **Utilities**: $250.00 limit, $100.00 spent (40%)

### Yearly Budgets
7. **Annual Savings Goal**: $12,000.00 limit, $500.00 spent (4%)

## Usage

Run the seed script after the finance service is deployed:

```bash
docker compose exec finance node /usr/src/app/seed-finance.js
```

Or as part of the development startup:

```bash
pnpm run docker:dev
```

## Notes

- All transactions use the demo user ID: `00000000-0000-0000-0000-000000000001`
- Transactions are dated in January 2026
- The seed script is idempotent - it will skip existing records if run multiple times
- Budget periods are set for January 2026 (monthly) and the full year 2026 (yearly)
