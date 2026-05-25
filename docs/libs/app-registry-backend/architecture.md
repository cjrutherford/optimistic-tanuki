# app-registry-backend Architecture

`app-registry-backend` is a small internal contract library that defines shared app-registry and navigation-link types plus default seed data.

## Main Responsibilities

- define registry contracts for internal app inventory
- define navigation-link contracts for generated and configured navigation
- ship default registry and navigation datasets for consumers

## Consumers

- `gateway`
- `app-registry`
- `owner-console`

The library is intentionally lightweight and should remain a stable contract boundary.
