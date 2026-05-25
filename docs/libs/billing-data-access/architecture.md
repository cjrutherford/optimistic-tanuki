# billing-data-access Architecture

`billing-data-access` contains the persistence-layer entities that back the billing service.

## Main Responsibilities

- model billing accounts by tenant and app scope
- model usage block grants and remaining balances
- model metered usage events with idempotency support

## Consumers

- `billing`

This library is intentionally entity-focused and should stay transport-agnostic.
