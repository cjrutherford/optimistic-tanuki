# billing-data-access Usage

Use this library from server-side persistence code that needs TypeORM entities for:

- account records
- usage grants
- usage events

The key operational invariant is event idempotency, especially around the unique `tenantId + appScope + eventKey` pattern on usage events.
