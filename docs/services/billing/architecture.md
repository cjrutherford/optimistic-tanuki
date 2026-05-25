# Billing Architecture

`billing` is a Nest TCP microservice for usage metering, usage-block accounting, and invoice-preview orchestration. It is designed as an internal service behind message-based callers rather than as a public HTTP surface.

## Main Responsibilities

- record individual usage events
- record usage in batches
- summarize metered usage
- grant and consume usage blocks
- prepare invoice-preview data for callers

## Runtime Model

- Nest microservice over TCP
- Node/Webpack Nx application
- shared billing contracts, domain logic, and data-access layers
- Postgres-backed persistence through TypeORM-backed repository abstractions

## Important Design Notes

- idempotency depends on correct handling of `eventKey`
- operational safety depends on schema ownership and avoiding accidental auto-sync in production-like environments
- callers should treat the service as a command and query backend rather than a workflow engine
